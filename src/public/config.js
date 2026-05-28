const CONFIG = {
  API_URL: "",
  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    QUESTIONS: "/api/questions",
  },
  FIELDS: {
    LOGIN: ["email", "password"],
    REGISTER: ["email", "password", "username"],
    QUESTION: ["question", "answer", "keywords"],
  },
  QUESTIONS_PER_PAGE: 5,
  STORAGE_KEY: "jwt_token",
  API_FIELDS: {
    SOLVED: "solved",
  },
  DIFFICULTIES: [
    { value: "EASY", label: "Easy", className: "easy" },
    { value: "INTERMEDIATE", label: "Intermediate", className: "intermediate" },
    { value: "HARD", label: "Hard", className: "hard" },
    { value: "ELITE", label: "Elite", className: "elite" },
  ],
};
