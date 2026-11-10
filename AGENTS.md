# Architecture rules

- Keep pending certificate schema contracts in the certificate modules and reuse the existing authenticated client; generated database types must describe the applied database only.
- Share lesson access calculations through the pure lessonAccess module with ISO dates in Europe/Rome; course cards and lesson outlines must agree without browser-locale comparisons.
- Load lesson calendars through useLessonSchedule and read temporary access overrides from protected site settings; opening material must not alter dates, enrolments, or completion rewards.