import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_BASE });

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem("access_token", data.access_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(error.config);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  register:        (data: object) => api.post("/auth/register", data),
  registerTeacher: (data: object) => api.post("/auth/register/teacher", data),
  login:           (data: object) => api.post("/auth/login", data),
  me:              ()             => api.get("/auth/me"),
  teacherCode:     ()             => api.get("/auth/teacher-code"),
  changePassword:  (data: object) => api.post("/auth/change-password", data),
  reportDevtools:  ()             => api.post("/auth/report-devtools"),
};

// ── Curriculum ────────────────────────────────────────────────
export const curriculumAPI = {
  list:      ()          => api.get("/curricula/"),
  upload:    (form: FormData) => api.post("/curricula/upload", form),
  structure: (id: string)     => api.get(`/curricula/${id}/structure`),
  delete:    (id: string)     => api.delete(`/curricula/${id}`),
};

// ── AI / Lessons ──────────────────────────────────────────────
export const aiAPI = {
  explanation:       (lessonId: string)               => api.get(`/ai/lesson/${lessonId}/explanation`),
  summary:           (lessonId: string)               => api.get(`/ai/lesson/${lessonId}/summary`),
  keyTerms:          (lessonId: string)               => api.get(`/ai/lesson/${lessonId}/key-terms`),
  flashcards:        (lessonId: string)               => api.get(`/ai/lesson/${lessonId}/flashcards`),
  resetFlashcards:   (lessonId: string)               => api.delete(`/ai/lesson/${lessonId}/flashcards`),
  updateVideo:       (lessonId: string, data: object) => api.patch(`/ai/lesson/${lessonId}/video`, data),
  removeVideo:       (lessonId: string)               => api.delete(`/ai/lesson/${lessonId}/video`),
  generateQuestions: (curriculumId: string, data: object) => api.post(`/ai/curriculum/${curriculumId}/questions`, data),
  allTerms:          (curriculumId: string)           => api.get(`/ai/curriculum/${curriculumId}/all-terms`),

  // Memorization
  getMemorization:    (lessonId: string)               => api.get(`/ai/lesson/${lessonId}/memorization`),
  updateMemorization: (lessonId: string, data: object) => api.post(`/ai/lesson/${lessonId}/memorization`, data),

  // Exam
  createExam:          (data: object)             => api.post("/ai/exam/create", data),
  submitExam:          (data: object)             => api.post("/ai/exam/submit", data),
  getExamResult:       (attemptId: string)        => api.get(`/ai/exam/${attemptId}/result`),
  myAttempts:          ()                         => api.get("/ai/student/attempts"),
  adaptiveDifficulty:  (curriculumId?: string)    => api.get("/ai/student/adaptive-difficulty", { params: curriculumId ? { curriculum_id: curriculumId } : {} }),
  aiAssistStatus:      ()                         => api.get("/ai/student/ai-assist-status"),
  examHint:            (data: object)             => api.post("/ai/exam/hint", data),
};

// ── Teacher ───────────────────────────────────────────────────
export const teacherAPI = {
  students:         ()                                  => api.get("/teacher/students"),
  studentAttempts:  (studentId: string)                 => api.get(`/teacher/students/${studentId}/attempts`),
  pending:          ()                                  => api.get("/teacher/pending"),
  attemptDetail:    (attemptId: string)                 => api.get(`/teacher/attempt/${attemptId}`),
  evaluate:         (attemptId: string, data: object)   => api.post(`/teacher/attempt/${attemptId}/evaluate`, data),
  aiSuggest:        (attemptId: string)                 => api.post(`/teacher/attempt/${attemptId}/ai-suggest`),
  examConfigs:      ()                                  => api.get("/teacher/exam-configs"),
  upsertExamConfig: (data: object)                      => api.put("/teacher/exam-configs", data),
  createStudent:    (data: object)                      => api.post("/teacher/students", data),
  resetStudentPassword: (studentId: string)             => api.post(`/teacher/students/${studentId}/reset-password`),
  updateChannelLinks: (links: { label: string; url: string }[]) => api.patch("/teacher/channel-links", { links }),
};

// ── Export ────────────────────────────────────────────────────
export const exportAPI = {
  examHtml: (attemptId: string, withAnswers = false) =>
    api.get(`/export/attempt/${attemptId}/pdf`, {
      params: withAnswers ? { answers: true } : {},
      responseType: "blob",
    }),
};

// ── Notifications ─────────────────────────────────────────────
export const notifAPI = {
  list:         () => api.get("/notifications"),
  unreadCount:  () => api.get("/notifications/unread-count"),
  markRead:     (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead:  () => api.post("/notifications/mark-all-read"),
};

// ── Admin ─────────────────────────────────────────────────────
export const adminAPI = {
  stats:       () => api.get("/admin/stats"),
  users:       (params?: object) => api.get("/admin/users", { params }),
  updateUser:  (id: string, data: object) => api.patch(`/admin/users/${id}`, data),
  settings:    () => api.get("/admin/settings"),
  saveSettings:(data: object) => api.post("/admin/settings", data),
  curricula:   (params?: object) => api.get("/admin/curricula", { params }),
  deleteCurriculum: (id: string) => api.delete(`/admin/curricula/${id}`),
  resetUserPassword: (userId: string) => api.post(`/admin/users/${userId}/reset-password`),
};

// ── Payments ──────────────────────────────────────────────────
export const paymentsAPI = {
  checkout:       (data: object) => api.post("/payments/checkout", data),
  checkSession:   (sessionId: string) => api.get(`/payments/session/${sessionId}`),
};

// ── Coupons ───────────────────────────────────────────────────
export const couponsAPI = {
  list:     ()                               => api.get("/admin/coupons"),
  create:   (data: object)                   => api.post("/admin/coupons", data),
  toggle:   (id: string)                     => api.patch(`/admin/coupons/${id}/toggle`),
  delete:   (id: string)                     => api.delete(`/admin/coupons/${id}`),
  validate: (code: string)                   => api.get(`/admin/coupons/validate/${code}`),
};

// ── Schedule ─────────────────────────────────────────────────
export const scheduleAPI = {
  get:              (studentId = "me")            => api.get(`/schedule/${studentId}`),
  saveSchool:       (studentId: string, entries: object[]) => api.put(`/schedule/${studentId}/school`, { entries }),
  saveStudy:        (studentId: string, entries: object[]) => api.put(`/schedule/${studentId}/study`, { entries }),
  removeStudyEntry: (studentId: string, day: string, start_time: string) =>
    api.delete(`/schedule/${studentId}/study/entry`, { params: { day, start_time } }),
};

// ── Question Bank ─────────────────────────────────────────────
export const questionBankAPI = {
  browse:  (params?: object)           => api.get("/question-bank", { params }),
  my:      ()                          => api.get("/question-bank/my"),
  publish: (data: object)              => api.post("/question-bank", data),
  delete:  (id: string)               => api.delete(`/question-bank/${id}`),
  import:  (id: string)               => api.post(`/question-bank/${id}/import`),
};
