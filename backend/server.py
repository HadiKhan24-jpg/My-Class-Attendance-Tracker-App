from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date
from bson import ObjectId


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Helper function to convert ObjectId to string
def objectid_to_str(obj):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, ObjectId):
                obj[key] = str(value)
            elif isinstance(value, dict):
                obj[key] = objectid_to_str(value)
            elif isinstance(value, list):
                obj[key] = [objectid_to_str(item) if isinstance(item, dict) else item for item in value]
    return obj

# ClassTrack Data Models
class Student(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    roll_number: str
    class_id: str

class StudentCreate(BaseModel):
    name: str
    roll_number: str
    class_id: str

class ClassInfo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    subject: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ClassCreate(BaseModel):
    name: str
    subject: str

class AttendanceRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    class_id: str
    date: date
    status: str  # "present", "absent", "late"
    marked_at: datetime = Field(default_factory=datetime.utcnow)

class AttendanceCreate(BaseModel):
    student_id: str
    class_id: str
    date: date
    status: str

class AttendanceBulkCreate(BaseModel):
    class_id: str
    date: date
    attendance_records: List[dict]  # [{student_id: str, status: str}]

# API Routes
@api_router.get("/")
async def root():
    return {"message": "ClassTrack API is running"}

# Classes endpoints
@api_router.post("/classes", response_model=ClassInfo)
async def create_class(class_data: ClassCreate):
    class_dict = class_data.dict()
    class_obj = ClassInfo(**class_dict)
    result = await db.classes.insert_one(class_obj.dict())
    return class_obj

@api_router.get("/classes", response_model=List[ClassInfo])
async def get_classes():
    classes = await db.classes.find().to_list(1000)
    return [ClassInfo(**objectid_to_str(cls)) for cls in classes]

@api_router.get("/classes/{class_id}", response_model=ClassInfo)
async def get_class(class_id: str):
    cls = await db.classes.find_one({"id": class_id})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    return ClassInfo(**objectid_to_str(cls))

# Students endpoints
@api_router.post("/students", response_model=Student)
async def create_student(student_data: StudentCreate):
    student_dict = student_data.dict()
    student_obj = Student(**student_dict)
    result = await db.students.insert_one(student_obj.dict())
    return student_obj

@api_router.get("/students", response_model=List[Student])
async def get_students(class_id: Optional[str] = None):
    query = {}
    if class_id:
        query["class_id"] = class_id
    students = await db.students.find(query).to_list(1000)
    return [Student(**objectid_to_str(student)) for student in students]

@api_router.get("/students/{student_id}", response_model=Student)
async def get_student(student_id: str):
    student = await db.students.find_one({"id": student_id})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return Student(**objectid_to_str(student))

# Attendance endpoints
@api_router.post("/attendance", response_model=AttendanceRecord)
async def mark_attendance(attendance_data: AttendanceCreate):
    # Check if attendance already exists for this student, class, and date
    existing = await db.attendance.find_one({
        "student_id": attendance_data.student_id,
        "class_id": attendance_data.class_id,
        "date": attendance_data.date.isoformat()
    })
    
    attendance_dict = attendance_data.dict()
    attendance_dict["date"] = attendance_data.date.isoformat()
    
    if existing:
        # Update existing attendance
        await db.attendance.update_one(
            {"id": existing["id"]},
            {"$set": {
                "status": attendance_data.status,
                "marked_at": datetime.utcnow().isoformat()
            }}
        )
        existing.update({
            "status": attendance_data.status,
            "marked_at": datetime.utcnow().isoformat()
        })
        return AttendanceRecord(**objectid_to_str(existing))
    else:
        # Create new attendance record
        attendance_obj = AttendanceRecord(**attendance_dict)
        # Convert the attendance object to dict and ensure date is string
        attendance_doc = attendance_obj.dict()
        attendance_doc["date"] = attendance_data.date.isoformat()
        attendance_doc["marked_at"] = datetime.utcnow().isoformat()
        result = await db.attendance.insert_one(attendance_doc)
        return attendance_obj

@api_router.post("/attendance/bulk")
async def mark_bulk_attendance(bulk_data: AttendanceBulkCreate):
    results = []
    for record in bulk_data.attendance_records:
        attendance_data = AttendanceCreate(
            student_id=record["student_id"],
            class_id=bulk_data.class_id,
            date=bulk_data.date,
            status=record["status"]
        )
        result = await mark_attendance(attendance_data)
        results.append(result)
    return {"message": f"Marked attendance for {len(results)} students", "records": results}

@api_router.get("/attendance")
async def get_attendance(class_id: str, date: Optional[str] = None):
    query = {"class_id": class_id}
    if date:
        query["date"] = date
    
    attendance_records = await db.attendance.find(query).to_list(1000)
    return [objectid_to_str(record) for record in attendance_records]

# Reports endpoints
@api_router.get("/reports/{class_id}")
async def get_class_report(class_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    # Get class info
    cls = await db.classes.find_one({"id": class_id})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Get students in class
    students = await db.students.find({"class_id": class_id}).to_list(1000)
    
    # Build date filter
    date_filter = {"class_id": class_id}
    if start_date:
        date_filter["date"] = {"$gte": start_date}
    if end_date:
        if "date" in date_filter:
            date_filter["date"]["$lte"] = end_date
        else:
            date_filter["date"] = {"$lte": end_date}
    
    # Get attendance records
    attendance_records = await db.attendance.find(date_filter).to_list(1000)
    
    # Calculate statistics for each student
    student_stats = {}
    for student in students:
        student_id = student["id"]
        student_attendance = [record for record in attendance_records if record["student_id"] == student_id]
        
        total_days = len(student_attendance)
        present_count = len([r for r in student_attendance if r["status"] == "present"])
        absent_count = len([r for r in student_attendance if r["status"] == "absent"])
        late_count = len([r for r in student_attendance if r["status"] == "late"])
        
        attendance_percentage = (present_count / total_days * 100) if total_days > 0 else 0
        
        student_stats[student_id] = {
            "student_name": student["name"],
            "roll_number": student["roll_number"],
            "total_days": total_days,
            "present": present_count,
            "absent": absent_count,
            "late": late_count,
            "attendance_percentage": round(attendance_percentage, 2)
        }
    
    return {
        "class_info": objectid_to_str(cls),
        "report_period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "student_statistics": student_stats
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
