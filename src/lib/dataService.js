// ============================================================
// THE ONE FILE THAT DECIDES WHERE DATA COMES FROM.
//
// Phase 1 (now)  : mock backend (localStorage). The whole app runs
//                  with zero infrastructure — perfect for development
//                  and the "temporary testing" milestone.
// Phase 2 (next) : implement src/lib/supabaseBackend.js exporting the
//                  SAME function names listed below, then change
//                  USE_MOCK to false. No page or component changes.
//
// BACKEND INTERFACE CONTRACT (both backends must implement all of these):
//   AUTH     : getSession, register, verifyEmail, login, logout,
//              requestPasswordReset, resetPassword
//   PROFILE  : getMyProfile, updateMyProfile
//   REQUESTS : listRequests(filters), getMyRequests, getRequest, createRequest,
//              updateRequest, cancelRequest, setRequestStatus, getMatches
//   MESSAGING: listConversations, getOrCreateConversation, getMessages, sendMessage
//   HOSPITALS: listHospitals, adminCreateHospital, adminSetHospitalStatus
//   RECORDS  : listRecords, createRecord
//   USERS    : listUsers, toggleUserRole
//   ADMIN    : getStats, listLogs
//   PUBLIC   : getPublicStats
// ============================================================

import mockBackend from './mockBackend';

const USE_MOCK = true; // Phase 2: set to false after supabaseBackend.js exists

// Phase 2:
// import supabaseBackend from './supabaseBackend';

const backend = USE_MOCK
  ? mockBackend
  : null; // Phase 2: supabaseBackend

export default backend;
