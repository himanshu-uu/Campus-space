/**
 * data.js — Static mock data layer for CampusPulse & SpaceSync
 * 
 * NOTE TO TEAM: Replace these arrays with real API calls to your backend.
 * The structure of each object mirrors the CSV columns exactly so swapping
 * to fetch() calls is a one-line change per dataset.
 *
 * Backend integration points are marked with: // API_REPLACE
 */

const ROOMS = [ // API_REPLACE: fetch('/api/rooms')
  { room_id:'R001', room_name:'Lecture Hall A',    building:'Academic Block',   floor:1, capacity:150, facilities:['Projector','AC','Smart Screen','Whiteboard'], accessible:true,  room_type:'lecture_hall',    status:'active'      },
  { room_id:'R002', room_name:'Lecture Hall B',    building:'Academic Block',   floor:2, capacity:120, facilities:['Projector','AC','Whiteboard'],               accessible:false, room_type:'lecture_hall',    status:'active'      },
  { room_id:'R003', room_name:'Seminar Room 1',    building:'Innovation Hub',   floor:1, capacity:40,  facilities:['Projector','Whiteboard','AC'],               accessible:true,  room_type:'seminar_room',    status:'active'      },
  { room_id:'R004', room_name:'Seminar Room 2',    building:'Innovation Hub',   floor:2, capacity:35,  facilities:['Projector','Whiteboard'],                    accessible:false, room_type:'seminar_room',    status:'active'      },
  { room_id:'R005', room_name:'Seminar Room 3',    building:'Innovation Hub',   floor:3, capacity:50,  facilities:['Projector','AC','Smart Screen'],             accessible:false, room_type:'seminar_room',    status:'active'      },
  { room_id:'R006', room_name:'Computer Lab 1',    building:'Tech Center',      floor:1, capacity:60,  facilities:['Lab Equipment','AC','Projector','Smart Screen'], accessible:true, room_type:'lab',          status:'active'      },
  { room_id:'R007', room_name:'Computer Lab 2',    building:'Tech Center',      floor:2, capacity:55,  facilities:['Lab Equipment','AC','Whiteboard'],           accessible:false, room_type:'lab',             status:'active'      },
  { room_id:'R008', room_name:'Board Room',        building:'Admin Block',      floor:1, capacity:20,  facilities:['Smart Screen','AC','Whiteboard','Projector'],accessible:true,  room_type:'board_room',      status:'active'      },
  { room_id:'R009', room_name:'Open Study Hall',   building:'Library',          floor:1, capacity:200, facilities:['Whiteboard','AC'],                           accessible:true,  room_type:'study_hall',      status:'active'      },
  { room_id:'R010', room_name:'Mini Theater',      building:'Arts Block',       floor:0, capacity:80,  facilities:['Smart Screen','Projector','AC'],             accessible:true,  room_type:'mini_theater',    status:'active'      },
  { room_id:'R011', room_name:'Design Studio',     building:'Arts Block',       floor:2, capacity:30,  facilities:['Whiteboard','AC'],                           accessible:false, room_type:'studio',          status:'active'      },
  { room_id:'R012', room_name:'Physics Lab',       building:'Science Block',    floor:1, capacity:45,  facilities:['Lab Equipment','AC','Whiteboard'],           accessible:true,  room_type:'lab',             status:'active'      },
  { room_id:'R013', room_name:'Chemistry Lab',     building:'Science Block',    floor:2, capacity:40,  facilities:['Lab Equipment','AC'],                        accessible:false, room_type:'lab',             status:'active'      },
  { room_id:'R014', room_name:'Discussion Room A', building:'Library',          floor:1, capacity:12,  facilities:['Whiteboard'],                                accessible:true,  room_type:'discussion_room', status:'active'      },
  { room_id:'R015', room_name:'Discussion Room B', building:'Library',          floor:1, capacity:12,  facilities:['Whiteboard','Projector'],                    accessible:true,  room_type:'discussion_room', status:'active'      },
  { room_id:'R016', room_name:'Conference Room',   building:'Admin Block',      floor:2, capacity:25,  facilities:['Smart Screen','AC','Projector'],             accessible:false, room_type:'conference_room', status:'active'      },
  { room_id:'R017', room_name:'Sports Meeting Rm', building:'Sports Complex',   floor:1, capacity:20,  facilities:['Whiteboard','AC'],                           accessible:true,  room_type:'meeting_room',    status:'active'      },
  { room_id:'R018', room_name:'Auditorium',        building:'Main Block',       floor:0, capacity:500, facilities:['Projector','Smart Screen','AC'],             accessible:true,  room_type:'auditorium',      status:'active'      },
  { room_id:'R019', room_name:'Rooftop Studio',    building:'Arts Block',       floor:4, capacity:25,  facilities:['Whiteboard'],                                accessible:false, room_type:'studio',          status:'maintenance' },
  { room_id:'R020', room_name:'Biotech Lab',       building:'Science Block',    floor:3, capacity:30,  facilities:['Lab Equipment','AC','Smart Screen'],         accessible:false, room_type:'lab',             status:'active'      },
];

const CLASS_SCHEDULE = [ // API_REPLACE: fetch('/api/schedules')
  { schedule_id:'CS001', room_id:'R006', date:'2026-10-19', start_time:'09:00', end_time:'11:00', course_name:'Data Structures',             enrolled_students:58  },
  { schedule_id:'CS002', room_id:'R001', date:'2026-10-19', start_time:'10:00', end_time:'12:00', course_name:'Engineering Mathematics',      enrolled_students:140 },
  { schedule_id:'CS003', room_id:'R003', date:'2026-10-19', start_time:'14:00', end_time:'16:00', course_name:'Communication Skills',         enrolled_students:38  },
  { schedule_id:'CS004', room_id:'R007', date:'2026-10-20', start_time:'09:00', end_time:'11:00', course_name:'Operating Systems',            enrolled_students:52  },
  { schedule_id:'CS005', room_id:'R002', date:'2026-10-20', start_time:'11:00', end_time:'13:00', course_name:'Economics for Engineers',      enrolled_students:110 },
  { schedule_id:'CS006', room_id:'R012', date:'2026-10-20', start_time:'14:00', end_time:'17:00', course_name:'Physics Lab',                  enrolled_students:42  },
  { schedule_id:'CS007', room_id:'R004', date:'2026-10-21', start_time:'09:00', end_time:'11:00', course_name:'Technical Writing',            enrolled_students:32  },
  { schedule_id:'CS008', room_id:'R006', date:'2026-10-21', start_time:'11:00', end_time:'13:00', course_name:'Machine Learning',             enrolled_students:55  },
  { schedule_id:'CS009', room_id:'R001', date:'2026-10-21', start_time:'14:00', end_time:'16:00', course_name:'Software Engineering',         enrolled_students:135 },
  { schedule_id:'CS010', room_id:'R013', date:'2026-10-22', start_time:'09:00', end_time:'12:00', course_name:'Chemistry Lab',                enrolled_students:38  },
  { schedule_id:'CS011', room_id:'R005', date:'2026-10-22', start_time:'13:00', end_time:'15:00', course_name:'Database Systems',             enrolled_students:47  },
  { schedule_id:'CS012', room_id:'R002', date:'2026-10-22', start_time:'15:00', end_time:'17:00', course_name:'Computer Networks',            enrolled_students:108 },
  { schedule_id:'CS013', room_id:'R003', date:'2026-10-23', start_time:'10:00', end_time:'12:00', course_name:'Entrepreneurship',             enrolled_students:36  },
  { schedule_id:'CS014', room_id:'R007', date:'2026-10-23', start_time:'13:00', end_time:'15:00', course_name:'Computer Graphics',            enrolled_students:50  },
  { schedule_id:'CS015', room_id:'R008', date:'2026-10-23', start_time:'15:00', end_time:'17:00', course_name:'Management Seminar',           enrolled_students:18  },
  { schedule_id:'CS016', room_id:'R006', date:'2026-10-19', start_time:'13:00', end_time:'15:00', course_name:'Web Development',              enrolled_students:57  },
  { schedule_id:'CS017', room_id:'R012', date:'2026-10-21', start_time:'09:00', end_time:'12:00', course_name:'Electronics Lab',              enrolled_students:40  },
  { schedule_id:'CS018', room_id:'R020', date:'2026-10-20', start_time:'13:00', end_time:'16:00', course_name:'Biotech Practicals',           enrolled_students:28  },
  { schedule_id:'CS019', room_id:'R005', date:'2026-10-19', start_time:'11:00', end_time:'13:00', course_name:'Artificial Intelligence',      enrolled_students:46  },
  { schedule_id:'CS020', room_id:'R001', date:'2026-10-20', start_time:'09:00', end_time:'11:00', course_name:'Digital Signal Processing',    enrolled_students:128 },
  { schedule_id:'CS021', room_id:'R003', date:'2026-10-22', start_time:'09:00', end_time:'11:00', course_name:'Human Computer Interaction',   enrolled_students:33  },
  { schedule_id:'CS022', room_id:'R004', date:'2026-10-23', start_time:'09:00', end_time:'11:00', course_name:'Cloud Computing',              enrolled_students:30  },
  { schedule_id:'CS023', room_id:'R016', date:'2026-10-21', start_time:'15:00', end_time:'17:00', course_name:'Research Methodology',         enrolled_students:22  },
  { schedule_id:'CS024', room_id:'R009', date:'2026-10-24', start_time:'10:00', end_time:'14:00', course_name:'Study Group Session',          enrolled_students:150 },
  { schedule_id:'CS025', room_id:'R002', date:'2026-10-19', start_time:'09:00', end_time:'11:00', course_name:'Embedded Systems',             enrolled_students:115 },
];

const EVENTS = [ // API_REPLACE: fetch('/api/events')
  { event_id:'EVT001', event_name:'TechFest Opening',       room_id:'R018', date:'2026-10-17', start_time:'09:00', end_time:'13:00', expected_attendance:480, event_type:'fest'         },
  { event_id:'EVT002', event_name:'AI & ML Workshop',        room_id:'R006', date:'2026-10-17', start_time:'14:00', end_time:'18:00', expected_attendance:55,  event_type:'workshop'     },
  { event_id:'EVT003', event_name:'Campus Career Fair',      room_id:'R009', date:'2026-10-18', start_time:'10:00', end_time:'17:00', expected_attendance:190, event_type:'career_fair'  },
  { event_id:'EVT004', event_name:'Startup Expo',            room_id:'R010', date:'2026-10-18', start_time:'11:00', end_time:'16:00', expected_attendance:75,  event_type:'expo'         },
  { event_id:'EVT005', event_name:'Photography Workshop',    room_id:'R011', date:'2026-10-19', start_time:'16:00', end_time:'18:00', expected_attendance:22,  event_type:'workshop'     },
  { event_id:'EVT006', event_name:'Classical Music Evening', room_id:'R010', date:'2026-10-19', start_time:'18:00', end_time:'21:00', expected_attendance:70,  event_type:'cultural'     },
  { event_id:'EVT007', event_name:'Research Symposium',      room_id:'R001', date:'2026-10-20', start_time:'09:00', end_time:'13:00', expected_attendance:140, event_type:'academic'     },
  { event_id:'EVT008', event_name:'Coding Marathon',         room_id:'R007', date:'2026-10-20', start_time:'18:00', end_time:'23:59',expected_attendance:50,  event_type:'competition'  },
  { event_id:'EVT009', event_name:'Alumni Meet',             room_id:'R018', date:'2026-10-21', start_time:'10:00', end_time:'18:00', expected_attendance:460, event_type:'networking'   },
  { event_id:'EVT010', event_name:'Design Thinking Sprint',  room_id:'R011', date:'2026-10-22', start_time:'10:00', end_time:'13:00', expected_attendance:25,  event_type:'workshop'     },
  { event_id:'EVT011', event_name:'Yoga & Wellness Day',     room_id:'R009', date:'2026-10-22', start_time:'06:30', end_time:'08:30', expected_attendance:80,  event_type:'wellness'     },
  { event_id:'EVT012', event_name:'Science Exhibition',      room_id:'R012', date:'2026-10-23', start_time:'10:00', end_time:'16:00', expected_attendance:40,  event_type:'exhibition'   },
  { event_id:'EVT013', event_name:'Debate Championship',     room_id:'R003', date:'2026-10-23', start_time:'14:00', end_time:'18:00', expected_attendance:38,  event_type:'competition'  },
  { event_id:'EVT014', event_name:'Cultural Night',          room_id:'R018', date:'2026-10-24', start_time:'17:00', end_time:'22:00', expected_attendance:490, event_type:'cultural'     },
  { event_id:'EVT015', event_name:'Industry Expert Talk',    room_id:'R005', date:'2026-10-25', start_time:'11:00', end_time:'13:00', expected_attendance:45,  event_type:'seminar'      },
  { event_id:'EVT016', event_name:'Open House',              room_id:'R009', date:'2026-10-26', start_time:'10:00', end_time:'15:00', expected_attendance:170, event_type:'administrative'},
  { event_id:'EVT017', event_name:'Math Olympiad',           room_id:'R002', date:'2026-10-17', start_time:'09:00', end_time:'12:00', expected_attendance:115, event_type:'competition'  },
  { event_id:'EVT018', event_name:'Robotics Demo',           room_id:'R006', date:'2026-10-18', start_time:'09:00', end_time:'12:00', expected_attendance:58,  event_type:'exhibition'   },
  { event_id:'EVT019', event_name:'Film Screening',          room_id:'R010', date:'2026-10-20', start_time:'17:00', end_time:'20:00', expected_attendance:75,  event_type:'cultural'     },
  { event_id:'EVT020', event_name:'Placement Training',      room_id:'R002', date:'2026-10-21', start_time:'14:00', end_time:'17:00', expected_attendance:110, event_type:'training'     },
];

// Room requests — also written to by the booking form (session state)
const ROOM_REQUESTS = [ // API_REPLACE: fetch('/api/requests')
  { request_id:'REQ001', requester_name:'Arjun Mehta',    requester_type:'student', group_name:'Robotics Club',          room_id:'R003', date:'2026-10-20', start_time:'16:00', end_time:'19:00', expected_attendees:25,  purpose:'Workshop: Intro to Robotics',       status:'pending'  },
  { request_id:'REQ002', requester_name:'Priya Sharma',   requester_type:'student', group_name:'Drama Society',          room_id:'R010', date:'2026-10-21', start_time:'17:00', end_time:'21:00', expected_attendees:70,  purpose:'Annual Drama Practice',             status:'pending'  },
  { request_id:'REQ003', requester_name:'Rahul Verma',    requester_type:'faculty', group_name:'Research Group',         room_id:'R016', date:'2026-10-22', start_time:'14:00', end_time:'16:00', expected_attendees:15,  purpose:'Research Presentation',             status:'approved' },
  { request_id:'REQ004', requester_name:'Sneha Patel',    requester_type:'student', group_name:'Coding Club',            room_id:'R006', date:'2026-10-23', start_time:'16:00', end_time:'20:00', expected_attendees:55,  purpose:'Hackathon Prelims',                 status:'pending'  },
  { request_id:'REQ005', requester_name:'Vikram Singh',   requester_type:'student', group_name:'Cultural Committee',     room_id:'R018', date:'2026-10-25', start_time:'10:00', end_time:'18:00', expected_attendees:400, purpose:'Cultural Fest Rehearsal',           status:'pending'  },
  { request_id:'REQ006', requester_name:'Ananya Roy',     requester_type:'faculty', group_name:'Dept. of CS',            room_id:'R001', date:'2026-10-24', start_time:'09:00', end_time:'13:00', expected_attendees:130, purpose:'Guest Lecture: AI Trends',          status:'approved' },
  { request_id:'REQ007', requester_name:'Deepak Kumar',   requester_type:'student', group_name:'Entrepreneurship Cell',  room_id:'R008', date:'2026-10-19', start_time:'16:00', end_time:'18:00', expected_attendees:12,  purpose:'Startup Pitching Session',          status:'pending'  },
  { request_id:'REQ008', requester_name:'Meera Nair',     requester_type:'student', group_name:'Photography Club',       room_id:'R011', date:'2026-10-21', start_time:'14:00', end_time:'16:00', expected_attendees:18,  purpose:'Photo Exhibition Planning',         status:'pending'  },
  { request_id:'REQ009', requester_name:'Kiran Rao',      requester_type:'student', group_name:'Literary Club',          room_id:'R014', date:'2026-10-20', start_time:'15:00', end_time:'17:00', expected_attendees:10,  purpose:'Book Discussion Session',           status:'approved' },
  { request_id:'REQ010', requester_name:'Tanvi Joshi',    requester_type:'student', group_name:'NSS Unit',               room_id:'R003', date:'2026-10-22', start_time:'16:00', end_time:'18:00', expected_attendees:35,  purpose:'Community Service Planning',        status:'pending'  },
  { request_id:'REQ011', requester_name:'Aditya Rao',     requester_type:'student', group_name:'Music Society',          room_id:'R017', date:'2026-10-23', start_time:'18:00', end_time:'21:00', expected_attendees:15,  purpose:'Band Practice',                     status:'pending'  },
  { request_id:'REQ012', requester_name:'Nisha Kapoor',   requester_type:'faculty', group_name:'Physics Dept.',          room_id:'R001', date:'2026-10-23', start_time:'09:00', end_time:'11:00', expected_attendees:145, purpose:'Remedial Lecture - Thermodynamics', status:'pending'  },
  { request_id:'REQ013', requester_name:'Ravi Teja',      requester_type:'student', group_name:'IEEE Student Branch',    room_id:'R005', date:'2026-10-24', start_time:'14:00', end_time:'17:00', expected_attendees:40,  purpose:'Technical Paper Presentation',      status:'pending'  },
  { request_id:'REQ014', requester_name:'Swati Mishra',   requester_type:'student', group_name:'Debating Society',       room_id:'R004', date:'2026-10-20', start_time:'17:00', end_time:'19:00', expected_attendees:28,  purpose:'Inter-College Debate Prep',         status:'pending'  },
  { request_id:'REQ015', requester_name:'Harish Menon',   requester_type:'faculty', group_name:'Admin',                  room_id:'R018', date:'2026-10-26', start_time:'09:00', end_time:'17:00', expected_attendees:450, purpose:'Annual Convocation',                status:'approved' },
];

// Utility: get Room object by ID
function getRoomById(id) {
  return ROOMS.find(r => r.room_id === id) || null;
}

// Utility: room type icon mapping
const ROOM_TYPE_ICONS = {
  lecture_hall:    '🎓',
  seminar_room:    '📋',
  lab:             '🔬',
  board_room:      '💼',
  discussion_room: '💬',
  mini_theater:    '🎭',
  auditorium:      '🏛️',
  study_hall:      '📚',
  studio:          '🎨',
  conference_room: '📊',
  meeting_room:    '🤝',
};
