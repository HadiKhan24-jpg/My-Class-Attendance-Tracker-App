import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as Print from 'expo-print';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface Student {
  id: string;
  name: string;
  roll_number: string;
  class_id: string;
}

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  marked_at: string;
}

interface StudentStat {
  student_name: string;
  roll_number: string;
  total_days: number;
  present: number;
  absent: number;
  late: number;
  attendance_percentage: number;
}

// App State Type
type Screen = 'home' | 'select-class' | 'attendance' | 'reports' | 'settings';

// Settings Context
interface AppSettings {
  voiceGuidance: boolean;
  highContrast: boolean;
  vibrationFeedback: boolean;
}

const defaultSettings: AppSettings = {
  voiceGuidance: false,
  highContrast: false,
  vibrationFeedback: false,
};

export default function ClassTrackApp() {
  // State Management
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [attendanceData, setAttendanceData] = useState<{[studentId: string]: string}>({});
  const [reportData, setReportData] = useState<{[studentId: string]: StudentStat}>({});
  const [loading, setLoading] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Load settings on startup
  useEffect(() => {
    setFontsLoaded(true); // Use system fonts for now
    loadSettings();
    fetchClasses();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('classtrack_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem('classtrack_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Voice guidance function
  const speakText = (text: string) => {
    if (settings.voiceGuidance) {
      Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.75,
      });
    }
  };

  // API Functions
  const fetchClasses = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/classes`);
      const data = await response.json();
      setClasses(data);
    } catch (error) {
      console.error('Error fetching classes:', error);
      Alert.alert('Error', 'Failed to load classes');
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/students?class_id=${classId}`);
      const data = await response.json();
      setStudents(data);
      
      // Initialize attendance data
      const initAttendance: {[key: string]: string} = {};
      data.forEach((student: Student) => {
        initAttendance[student.id] = 'present';
      });
      setAttendanceData(initAttendance);
    } catch (error) {
      console.error('Error fetching students:', error);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const saveAttendance = async () => {
    if (!selectedClass) return;

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const attendanceRecords = Object.entries(attendanceData).map(([studentId, status]) => ({
        student_id: studentId,
        status: status,
      }));

      const response = await fetch(`${BACKEND_URL}/api/attendance/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: selectedClass.id,
          date: today,
          attendance_records: attendanceRecords,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Attendance saved successfully!');
        speakText('Attendance saved successfully');
      } else {
        throw new Error('Failed to save attendance');
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async (classId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/reports/${classId}`);
      const data = await response.json();
      setReportData(data.student_statistics || {});
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!selectedClass || Object.keys(reportData).length === 0) return;

    try {
      const htmlContent = generateReportHTML();
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      Alert.alert('Success', `Report exported successfully!\nLocation: ${uri}`);
      speakText('Report exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF');
    }
  };

  const generateReportHTML = () => {
    const studentStats = Object.values(reportData);
    const rows = studentStats.map((stat) => `
      <tr>
        <td>${stat.student_name}</td>
        <td>${stat.attendance_percentage}%</td>
        <td>${stat.present}</td>
        <td>${stat.absent}</td>
        <td>${stat.late}</td>
      </tr>
    `).join('');

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #2196F3; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>ClassTrack Attendance Report</h1>
          <h2>${selectedClass?.name} - ${selectedClass?.subject}</h2>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <tr>
              <th>Student Name</th>
              <th>Attendance %</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Late</th>
            </tr>
            ${rows}
          </table>
        </body>
      </html>
    `;
  };

  // Screen Navigation
  const navigateToScreen = (screen: Screen, classInfo?: ClassInfo) => {
    speakText(`Navigating to ${screen.replace('-', ' ')} screen`);
    setCurrentScreen(screen);
    
    if (classInfo) {
      setSelectedClass(classInfo);
      if (screen === 'attendance') {
        fetchStudents(classInfo.id);
      } else if (screen === 'reports') {
        fetchReports(classInfo.id);
      }
    }
  };

  // Get theme styles based on settings
  const getThemeStyles = () => {
    if (settings.highContrast) {
      return {
        backgroundColor: '#000000',
        textColor: '#FFFFFF',
        buttonColor: '#FFFFFF',
        buttonTextColor: '#000000',
      };
    }
    return {
      backgroundColor: '#F5F5F5',
      textColor: '#333333',
      buttonColor: '#2196F3',
      buttonTextColor: '#FFFFFF',
    };
  };

  const theme = getThemeStyles();

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading ClassTrack...</Text>
      </SafeAreaView>
    );
  }

  // Render Different Screens
  const renderHomeScreen = () => (
    <SafeAreaView style={[styles.homeContainer, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar barStyle={settings.highContrast ? 'light-content' : 'dark-content'} />
      
      <View style={styles.homeHeader}>
        <Ionicons name="school" size={60} color={theme.buttonColor} />
        <Text style={[styles.homeTitle, { color: theme.textColor }]}>ClassTrack</Text>
        <Text style={[styles.homeSubtitle, { color: theme.textColor }]}>Attendance Marker App</Text>
      </View>

      <View style={styles.homeButtons}>
        <TouchableOpacity
          style={[styles.homeButton, { backgroundColor: theme.buttonColor }]}
          onPress={() => {
            speakText('Select Class');
            navigateToScreen('select-class');
          }}
          accessibilityLabel="Select Class Button"
        >
          <Ionicons name="book" size={30} color={theme.buttonTextColor} />
          <Text style={[styles.homeButtonText, { color: theme.buttonTextColor }]}>Select Class</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.homeButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => {
            speakText('View Reports');
            navigateToScreen('select-class');
          }}
          accessibilityLabel="View Reports Button"
        >
          <Ionicons name="bar-chart" size={30} color="white" />
          <Text style={[styles.homeButtonText, { color: 'white' }]}>View Reports</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => {
          speakText('Settings');
          navigateToScreen('settings');
        }}
        accessibilityLabel="Settings Button"
      >
        <Ionicons name="settings" size={24} color={theme.textColor} />
        <Text style={[styles.settingsButtonText, { color: theme.textColor }]}>Settings</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const renderSelectClassScreen = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateToScreen('home')}
          style={styles.backButton}
          accessibilityLabel="Back Button"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Select Class</Text>
      </View>

      <ScrollView style={styles.classListContainer}>
        {classes.map((classInfo) => (
          <View key={classInfo.id} style={styles.classButtonContainer}>
            <TouchableOpacity
              style={[styles.classButton, { backgroundColor: theme.buttonColor }]}
              onPress={() => {
                speakText(`${classInfo.name} ${classInfo.subject}`);
                navigateToScreen('attendance', classInfo);
              }}
              accessibilityLabel={`${classInfo.name} ${classInfo.subject}`}
            >
              <Text style={[styles.classButtonText, { color: theme.buttonTextColor }]}>
                {classInfo.name}
              </Text>
              <Text style={[styles.classSubjectText, { color: theme.buttonTextColor }]}>
                {classInfo.subject}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reportsButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => {
                speakText(`Reports for ${classInfo.name}`);
                navigateToScreen('reports', classInfo);
              }}
              accessibilityLabel={`View reports for ${classInfo.name}`}
            >
              <Ionicons name="bar-chart" size={20} color="white" />
              <Text style={styles.reportsButtonText}>Reports</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  const renderAttendanceScreen = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateToScreen('select-class')}
          style={styles.backButton}
          accessibilityLabel="Back Button"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.attendanceTitle, { color: theme.textColor }]}>Attendance</Text>
          <Text style={[styles.attendanceSubtitle, { color: theme.textColor }]}>
            {selectedClass?.name} - {new Date().toLocaleDateString()}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.attendanceContainer}>
        {students.map((student) => (
          <View key={student.id} style={[styles.studentRow, { borderBottomColor: theme.textColor }]}>
            <TouchableOpacity
              onPress={() => speakText(student.name)}
              style={styles.studentInfo}
            >
              <Text style={[styles.studentName, { color: theme.textColor }]}>{student.name}</Text>
              <Text style={[styles.studentRoll, { color: theme.textColor }]}>Roll: {student.roll_number}</Text>
            </TouchableOpacity>

            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  styles.presentButton,
                  attendanceData[student.id] === 'present' && styles.selectedButton
                ]}
                onPress={() => {
                  setAttendanceData({...attendanceData, [student.id]: 'present'});
                  speakText(`${student.name} marked present`);
                }}
                accessibilityLabel={`Mark ${student.name} present`}
              >
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.attendanceButtonText}>Present</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  styles.absentButton,
                  attendanceData[student.id] === 'absent' && styles.selectedButton
                ]}
                onPress={() => {
                  setAttendanceData({...attendanceData, [student.id]: 'absent'});
                  speakText(`${student.name} marked absent`);
                }}
                accessibilityLabel={`Mark ${student.name} absent`}
              >
                <Ionicons name="close" size={20} color="white" />
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  styles.lateButton,
                  attendanceData[student.id] === 'late' && styles.selectedButton
                ]}
                onPress={() => {
                  setAttendanceData({...attendanceData, [student.id]: 'late'});
                  speakText(`${student.name} marked late`);
                }}
                accessibilityLabel={`Mark ${student.name} late`}
              >
                <Ionicons name="time" size={20} color="white" />
                <Text style={styles.attendanceButtonText}>Late</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.attendanceFooter}>
        <TouchableOpacity
          style={[styles.footerButton, styles.saveButton]}
          onPress={saveAttendance}
          disabled={loading}
          accessibilityLabel="Save Attendance"
        >
          <Ionicons name="save" size={24} color="white" />
          <Text style={styles.footerButtonText}>Save Attendance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButton, styles.resetButton]}
          onPress={() => {
            const resetData: {[key: string]: string} = {};
            students.forEach(student => {
              resetData[student.id] = 'present';
            });
            setAttendanceData(resetData);
            speakText('Attendance reset');
          }}
          accessibilityLabel="Reset Attendance"
        >
          <Ionicons name="refresh" size={24} color="white" />
          <Text style={styles.footerButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderReportsScreen = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateToScreen('select-class')}
          style={styles.backButton}
          accessibilityLabel="Back Button"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Reports</Text>
      </View>

      <ScrollView style={styles.reportsContainer}>
        <Text style={[styles.reportsTitle, { color: theme.textColor }]}>
          {selectedClass?.name} - {selectedClass?.subject}
        </Text>

        <View style={[styles.reportsTable, { borderColor: theme.textColor }]}>
          <View style={[styles.tableHeader, { backgroundColor: theme.buttonColor }]}>
            <Text style={[styles.tableHeaderText, { color: theme.buttonTextColor }]}>Name</Text>
            <Text style={[styles.tableHeaderText, { color: theme.buttonTextColor }]}>Total %</Text>
            <Text style={[styles.tableHeaderText, { color: theme.buttonTextColor }]}>Present</Text>
            <Text style={[styles.tableHeaderText, { color: theme.buttonTextColor }]}>Absent</Text>
            <Text style={[styles.tableHeaderText, { color: theme.buttonTextColor }]}>Late</Text>
          </View>

          {Object.values(reportData).map((stat, index) => (
            <View key={index} style={[styles.tableRow, { borderBottomColor: theme.textColor }]}>
              <Text style={[styles.tableCellText, { color: theme.textColor }]}>{stat.student_name}</Text>
              <Text style={[styles.tableCellText, { color: theme.textColor }]}>{stat.attendance_percentage}%</Text>
              <Text style={[styles.tableCellText, { color: theme.textColor }]}>{stat.present}</Text>
              <Text style={[styles.tableCellText, { color: theme.textColor }]}>{stat.absent}</Text>
              <Text style={[styles.tableCellText, { color: theme.textColor }]}>{stat.late}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: '#FF9800' }]}
          onPress={exportToPDF}
          accessibilityLabel="Export Report to PDF"
        >
          <Ionicons name="document" size={24} color="white" />
          <Text style={styles.exportButtonText}>Export Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderSettingsScreen = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateToScreen('home')}
          style={styles.backButton}
          accessibilityLabel="Back Button"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Settings</Text>
      </View>

      <ScrollView style={styles.settingsContainer}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="volume-high" size={24} color={theme.textColor} />
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Enable Voice Guidance</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggle,
              settings.voiceGuidance ? styles.toggleActive : styles.toggleInactive
            ]}
            onPress={() => {
              const newSettings = {...settings, voiceGuidance: !settings.voiceGuidance};
              saveSettings(newSettings);
              speakText(newSettings.voiceGuidance ? 'Voice guidance enabled' : 'Voice guidance disabled');
            }}
            accessibilityLabel="Toggle Voice Guidance"
          >
            <View style={[
              styles.toggleThumb,
              settings.voiceGuidance ? styles.thumbActive : styles.thumbInactive
            ]} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="contrast" size={24} color={theme.textColor} />
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Enable High-Contrast Mode</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggle,
              settings.highContrast ? styles.toggleActive : styles.toggleInactive
            ]}
            onPress={() => {
              const newSettings = {...settings, highContrast: !settings.highContrast};
              saveSettings(newSettings);
              speakText(newSettings.highContrast ? 'High contrast enabled' : 'High contrast disabled');
            }}
            accessibilityLabel="Toggle High Contrast Mode"
          >
            <View style={[
              styles.toggleThumb,
              settings.highContrast ? styles.thumbActive : styles.thumbInactive
            ]} />
          </TouchableOpacity>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="phone-portrait" size={24} color={theme.textColor} />
            <Text style={[styles.settingLabel, { color: theme.textColor }]}>Enable Vibration Feedback</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggle,
              settings.vibrationFeedback ? styles.toggleActive : styles.toggleInactive
            ]}
            onPress={() => {
              const newSettings = {...settings, vibrationFeedback: !settings.vibrationFeedback};
              saveSettings(newSettings);
              speakText(newSettings.vibrationFeedback ? 'Vibration feedback enabled' : 'Vibration feedback disabled');
            }}
            accessibilityLabel="Toggle Vibration Feedback"
          >
            <View style={[
              styles.toggleThumb,
              settings.vibrationFeedback ? styles.thumbActive : styles.thumbInactive
            ]} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // Main render function
  switch (currentScreen) {
    case 'home':
      return renderHomeScreen();
    case 'select-class':
      return renderSelectClassScreen();
    case 'attendance':
      return renderAttendanceScreen();
    case 'reports':
      return renderReportsScreen();
    case 'settings':
      return renderSettingsScreen();
    default:
      return renderHomeScreen();
  }
}

// Styles with different fonts for each screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  
  // Home Screen Styles (System/Arial font family)
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  homeHeader: {
    alignItems: 'center',
    marginBottom: 60,
  },
  homeTitle: {
    fontSize: 36,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontWeight: 'bold',
    marginTop: 20,
  },
  homeSubtitle: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    marginTop: 8,
    opacity: 0.7,
  },
  homeButtons: {
    width: '100%',
    gap: 20,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    minHeight: 60,
  },
  homeButtonText: {
    fontSize: 18,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontWeight: '600',
    marginLeft: 12,
  },
  settingsButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButtonText: {
    marginLeft: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },

  // Header Styles (Roboto font family)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },

  // Select Class Screen Styles (serif font family)
  classListContainer: {
    flex: 1,
    padding: 20,
  },
  classButtonContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  classButton: {
    flex: 1,
    padding: 20,
    borderRadius: 8,
    minHeight: 70,
    justifyContent: 'center',
  },
  classButtonText: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: 'bold',
  },
  classSubjectText: {
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    marginTop: 4,
    opacity: 0.9,
  },
  reportsButton: {
    padding: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  reportsButtonText: {
    color: 'white',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    marginTop: 4,
  },

  // Attendance Screen Styles (monospace font family)
  attendanceTitle: {
    fontSize: 18,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    fontWeight: 'bold',
  },
  attendanceSubtitle: {
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    marginTop: 4,
    opacity: 0.7,
  },
  attendanceContainer: {
    flex: 1,
    padding: 20,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    fontWeight: '600',
  },
  studentRoll: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    marginTop: 2,
    opacity: 0.6,
  },
  attendanceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    minWidth: 70,
    justifyContent: 'center',
  },
  attendanceButtonText: {
    color: 'white',
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    marginLeft: 4,
  },
  presentButton: {
    backgroundColor: '#4CAF50',
  },
  absentButton: {
    backgroundColor: '#F44336',
  },
  lateButton: {
    backgroundColor: '#FF9800',
  },
  selectedButton: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  attendanceFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
  },
  footerButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
    marginLeft: 8,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  resetButton: {
    backgroundColor: '#757575',
  },

  // Reports Screen Styles (Helvetica font family)
  reportsContainer: {
    flex: 1,
    padding: 20,
  },
  reportsTitle: {
    fontSize: 18,
    fontFamily: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif-medium' }),
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  reportsTable: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif-medium' }),
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
  },
  tableCellText: {
    flex: 1,
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif-medium' }),
    textAlign: 'center',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif-medium' }),
    marginLeft: 8,
    fontWeight: '600',
  },

  // Settings Screen Styles (System font family)
  settingsContainer: {
    flex: 1,
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    marginLeft: 15,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleInactive: {
    backgroundColor: '#CCCCCC',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
  },
  thumbActive: {
    alignSelf: 'flex-end',
  },
  thumbInactive: {
    alignSelf: 'flex-start',
  },
});