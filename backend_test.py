#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for ClassTrack Attendance App
Tests all endpoints with realistic data and edge cases
"""

import requests
import json
from datetime import datetime, date, timedelta
import uuid
import sys

# Use the production URL from frontend .env
BASE_URL = "https://classtrack-app-1.preview.emergentagent.com/api"

class ClassTrackAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.created_classes = []
        self.created_students = []
        self.test_results = []
        
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "data": data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"   {message}")
        if not success and data:
            print(f"   Response: {data}")
        print()

    def test_api_health(self):
        """Test 1: API Health Check"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "ClassTrack API is running" in data.get("message", ""):
                    self.log_test("API Health Check", True, "API is running correctly")
                    return True
                else:
                    self.log_test("API Health Check", False, "Unexpected response message", data)
                    return False
            else:
                self.log_test("API Health Check", False, f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_create_classes(self):
        """Test 2: Create Sample Classes"""
        classes_to_create = [
            {"name": "2nd Year Physics", "subject": "Physics"},
            {"name": "2nd Year Mathematics", "subject": "Mathematics"},
            {"name": "1st Year Chemistry", "subject": "Chemistry"}
        ]
        
        all_success = True
        for class_data in classes_to_create:
            try:
                response = self.session.post(f"{self.base_url}/classes", json=class_data)
                if response.status_code == 200:
                    created_class = response.json()
                    self.created_classes.append(created_class)
                    self.log_test(f"Create Class: {class_data['name']}", True, 
                                f"Class ID: {created_class['id']}")
                else:
                    self.log_test(f"Create Class: {class_data['name']}", False, 
                                f"Status code: {response.status_code}", response.text)
                    all_success = False
            except Exception as e:
                self.log_test(f"Create Class: {class_data['name']}", False, f"Error: {str(e)}")
                all_success = False
        
        return all_success

    def test_get_classes(self):
        """Test 3: Get All Classes"""
        try:
            response = self.session.get(f"{self.base_url}/classes")
            if response.status_code == 200:
                classes = response.json()
                if len(classes) >= len(self.created_classes):
                    self.log_test("Get All Classes", True, 
                                f"Retrieved {len(classes)} classes")
                    return True
                else:
                    self.log_test("Get All Classes", False, 
                                f"Expected at least {len(self.created_classes)} classes, got {len(classes)}")
                    return False
            else:
                self.log_test("Get All Classes", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get All Classes", False, f"Error: {str(e)}")
            return False

    def test_get_specific_class(self):
        """Test 4: Get Specific Class"""
        if not self.created_classes:
            self.log_test("Get Specific Class", False, "No classes available to test")
            return False
            
        class_to_test = self.created_classes[0]
        try:
            response = self.session.get(f"{self.base_url}/classes/{class_to_test['id']}")
            if response.status_code == 200:
                class_data = response.json()
                if class_data['id'] == class_to_test['id']:
                    self.log_test("Get Specific Class", True, 
                                f"Retrieved class: {class_data['name']}")
                    return True
                else:
                    self.log_test("Get Specific Class", False, "ID mismatch in response")
                    return False
            else:
                self.log_test("Get Specific Class", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Specific Class", False, f"Error: {str(e)}")
            return False

    def test_create_students(self):
        """Test 5: Create Sample Students"""
        if not self.created_classes:
            self.log_test("Create Students", False, "No classes available")
            return False
            
        students_data = [
            # Physics class students
            {"name": "Alice Johnson", "roll_number": "PH2021001", "class_id": self.created_classes[0]['id']},
            {"name": "Bob Smith", "roll_number": "PH2021002", "class_id": self.created_classes[0]['id']},
            {"name": "Carol Davis", "roll_number": "PH2021003", "class_id": self.created_classes[0]['id']},
            
            # Math class students  
            {"name": "David Wilson", "roll_number": "MT2021001", "class_id": self.created_classes[1]['id']},
            {"name": "Emma Brown", "roll_number": "MT2021002", "class_id": self.created_classes[1]['id']},
            
            # Chemistry class students
            {"name": "Frank Miller", "roll_number": "CH2022001", "class_id": self.created_classes[2]['id']},
            {"name": "Grace Taylor", "roll_number": "CH2022002", "class_id": self.created_classes[2]['id']},
        ]
        
        all_success = True
        for student_data in students_data:
            try:
                response = self.session.post(f"{self.base_url}/students", json=student_data)
                if response.status_code == 200:
                    created_student = response.json()
                    self.created_students.append(created_student)
                    self.log_test(f"Create Student: {student_data['name']}", True, 
                                f"Roll: {student_data['roll_number']}")
                else:
                    self.log_test(f"Create Student: {student_data['name']}", False, 
                                f"Status code: {response.status_code}", response.text)
                    all_success = False
            except Exception as e:
                self.log_test(f"Create Student: {student_data['name']}", False, f"Error: {str(e)}")
                all_success = False
        
        return all_success

    def test_get_students_by_class(self):
        """Test 6: Get Students by Class"""
        if not self.created_classes:
            self.log_test("Get Students by Class", False, "No classes available")
            return False
            
        class_to_test = self.created_classes[0]  # Physics class
        try:
            response = self.session.get(f"{self.base_url}/students?class_id={class_to_test['id']}")
            if response.status_code == 200:
                students = response.json()
                physics_students = [s for s in self.created_students if s['class_id'] == class_to_test['id']]
                if len(students) >= len(physics_students):
                    self.log_test("Get Students by Class", True, 
                                f"Retrieved {len(students)} students for {class_to_test['name']}")
                    return True
                else:
                    self.log_test("Get Students by Class", False, 
                                f"Expected {len(physics_students)} students, got {len(students)}")
                    return False
            else:
                self.log_test("Get Students by Class", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Students by Class", False, f"Error: {str(e)}")
            return False

    def test_get_specific_student(self):
        """Test 7: Get Specific Student"""
        if not self.created_students:
            self.log_test("Get Specific Student", False, "No students available")
            return False
            
        student_to_test = self.created_students[0]
        try:
            response = self.session.get(f"{self.base_url}/students/{student_to_test['id']}")
            if response.status_code == 200:
                student_data = response.json()
                if student_data['id'] == student_to_test['id']:
                    self.log_test("Get Specific Student", True, 
                                f"Retrieved student: {student_data['name']}")
                    return True
                else:
                    self.log_test("Get Specific Student", False, "ID mismatch in response")
                    return False
            else:
                self.log_test("Get Specific Student", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Specific Student", False, f"Error: {str(e)}")
            return False

    def test_individual_attendance(self):
        """Test 8: Mark Individual Attendance"""
        if not self.created_students or not self.created_classes:
            self.log_test("Individual Attendance", False, "No students or classes available")
            return False
            
        # Mark attendance for first student
        student = self.created_students[0]
        today = date.today().isoformat()
        
        attendance_data = {
            "student_id": student['id'],
            "class_id": student['class_id'],
            "date": today,
            "status": "present"
        }
        
        try:
            response = self.session.post(f"{self.base_url}/attendance", json=attendance_data)
            if response.status_code == 200:
                attendance_record = response.json()
                self.log_test("Individual Attendance", True, 
                            f"Marked {student['name']} as present")
                return True
            else:
                self.log_test("Individual Attendance", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Individual Attendance", False, f"Error: {str(e)}")
            return False

    def test_bulk_attendance(self):
        """Test 9: Mark Bulk Attendance"""
        if not self.created_students or not self.created_classes:
            self.log_test("Bulk Attendance", False, "No students or classes available")
            return False
            
        # Get physics class students
        physics_class = self.created_classes[0]
        physics_students = [s for s in self.created_students if s['class_id'] == physics_class['id']]
        
        if len(physics_students) < 2:
            self.log_test("Bulk Attendance", False, "Not enough students in physics class")
            return False
            
        today = date.today().isoformat()
        attendance_records = []
        
        for i, student in enumerate(physics_students):
            status = "present" if i % 2 == 0 else "late"  # Alternate between present and late
            attendance_records.append({
                "student_id": student['id'],
                "status": status
            })
        
        bulk_data = {
            "class_id": physics_class['id'],
            "date": today,
            "attendance_records": attendance_records
        }
        
        try:
            response = self.session.post(f"{self.base_url}/attendance/bulk", json=bulk_data)
            if response.status_code == 200:
                result = response.json()
                self.log_test("Bulk Attendance", True, 
                            f"Marked attendance for {len(attendance_records)} students")
                return True
            else:
                self.log_test("Bulk Attendance", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Bulk Attendance", False, f"Error: {str(e)}")
            return False

    def test_get_attendance(self):
        """Test 10: Get Attendance Records"""
        if not self.created_classes:
            self.log_test("Get Attendance", False, "No classes available")
            return False
            
        physics_class = self.created_classes[0]
        today = date.today().isoformat()
        
        try:
            response = self.session.get(f"{self.base_url}/attendance?class_id={physics_class['id']}&date={today}")
            if response.status_code == 200:
                attendance_records = response.json()
                self.log_test("Get Attendance", True, 
                            f"Retrieved {len(attendance_records)} attendance records")
                return True
            else:
                self.log_test("Get Attendance", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Get Attendance", False, f"Error: {str(e)}")
            return False

    def test_class_report(self):
        """Test 11: Generate Class Report"""
        if not self.created_classes:
            self.log_test("Class Report", False, "No classes available")
            return False
            
        physics_class = self.created_classes[0]
        start_date = (date.today() - timedelta(days=7)).isoformat()
        end_date = date.today().isoformat()
        
        try:
            response = self.session.get(
                f"{self.base_url}/reports/{physics_class['id']}?start_date={start_date}&end_date={end_date}"
            )
            if response.status_code == 200:
                report = response.json()
                if "class_info" in report and "student_statistics" in report:
                    self.log_test("Class Report", True, 
                                f"Generated report for {report['class_info']['name']}")
                    return True
                else:
                    self.log_test("Class Report", False, "Missing required fields in report")
                    return False
            else:
                self.log_test("Class Report", False, 
                            f"Status code: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Class Report", False, f"Error: {str(e)}")
            return False

    def test_error_handling(self):
        """Test 12: Error Handling and Edge Cases"""
        tests_passed = 0
        total_tests = 3
        
        # Test 1: Get non-existent class
        try:
            response = self.session.get(f"{self.base_url}/classes/non-existent-id")
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Class", True, "Correctly returned 404")
                tests_passed += 1
            else:
                self.log_test("Error Handling - Non-existent Class", False, 
                            f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Class", False, f"Error: {str(e)}")
        
        # Test 2: Get non-existent student
        try:
            response = self.session.get(f"{self.base_url}/students/non-existent-id")
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Student", True, "Correctly returned 404")
                tests_passed += 1
            else:
                self.log_test("Error Handling - Non-existent Student", False, 
                            f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Student", False, f"Error: {str(e)}")
        
        # Test 3: Get report for non-existent class
        try:
            response = self.session.get(f"{self.base_url}/reports/non-existent-id")
            if response.status_code == 404:
                self.log_test("Error Handling - Non-existent Class Report", True, "Correctly returned 404")
                tests_passed += 1
            else:
                self.log_test("Error Handling - Non-existent Class Report", False, 
                            f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Error Handling - Non-existent Class Report", False, f"Error: {str(e)}")
        
        return tests_passed == total_tests

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("ClassTrack Backend API Comprehensive Test Suite")
        print("=" * 60)
        print(f"Testing API at: {self.base_url}")
        print()
        
        test_methods = [
            self.test_api_health,
            self.test_create_classes,
            self.test_get_classes,
            self.test_get_specific_class,
            self.test_create_students,
            self.test_get_students_by_class,
            self.test_get_specific_student,
            self.test_individual_attendance,
            self.test_bulk_attendance,
            self.test_get_attendance,
            self.test_class_report,
            self.test_error_handling
        ]
        
        passed_tests = 0
        total_tests = len(test_methods)
        
        for test_method in test_methods:
            if test_method():
                passed_tests += 1
        
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
            return True
        else:
            print(f"\n⚠️  {total_tests - passed_tests} tests failed. Check the details above.")
            return False

def main():
    """Main function to run the tests"""
    tester = ClassTrackAPITester()
    success = tester.run_all_tests()
    
    # Return appropriate exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()