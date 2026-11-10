import { test, expect } from './support/test';
import { course, lesson, seedStudent, student } from './support/seed';

test('temporary override opens all lessons without a group calendar', async ({ page, fake }) => {
  seedStudent(fake);
  fake.seed('site_settings', [{ key: 'lesson_access_override', value: { unlockAll: true }, is_public: true }]);
  fake.seed('lessons', [
    { ...lesson, lesson_number: 2, id: 'a0000000-0000-4000-8000-000000000002', title: 'Lezione senza calendario' },
  ]);
  await fake.signInBeforeLoad(page, student);
  await page.goto(`/area-riservata/corso/${course.id}`);
  const opened = page.getByRole('link').filter({ hasText: 'Lezione senza calendario' });
  await expect(opened).toHaveCount(1);
  await opened.click();
  await expect(page).toHaveURL(new RegExp('/lezione/2$'));
  await expect(page.getByText('Lezione senza calendario', { exact: true }).first()).toBeVisible();
});

test('opens scheduled material with an unfinished previous lesson but keeps future lessons locked', async ({ page, fake }) => {
  await page.clock.setFixedTime(new Date('2026-11-10T17:46:00Z'));
  seedStudent(fake);
  const groupId = 'e1000000-0000-4000-8000-000000000001';
  fake.seed('student_groups', [{ id: groupId, course_id: course.id, group_students: { student_id: student.id } }]);
  fake.seed('group_students', [{ group_id: groupId, student_id: student.id }]);
  fake.seed('lessons', [
    { ...lesson, lesson_number: 2, id: 'a0000000-0000-4000-8000-000000000002', title: 'Lezione del 10 novembre' },
    { ...lesson, lesson_number: 3, id: 'a0000000-0000-4000-8000-000000000003', title: 'Lezione del 17 novembre' },
  ]);
  fake.seed('group_lesson_schedule', [
    { group_id: groupId, lesson_number: 1, lesson_date: '2026-11-03' },
    { group_id: groupId, lesson_number: 2, lesson_date: '2026-11-10' },
    { group_id: groupId, lesson_number: 3, lesson_date: '2026-11-17' },
  ]);
  await fake.signInBeforeLoad(page, student);
  await page.goto(`/area-riservata/corso/${course.id}`);
  const current = page.getByRole('link').filter({ hasText: 'Lezione del 10 novembre' });
  await expect(current).toHaveCount(1);
  await expect(page.getByRole('link').filter({ hasText: 'Lezione del 17 novembre' })).toHaveCount(0);
  await current.click();
  await expect(page).toHaveURL(new RegExp('/lezione/2$'));
  await expect(page.getByText('Lezione non trovata')).toHaveCount(0);
  await expect(page.getByText('Lezione del 10 novembre', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: '/tmp/browser/lesson-lock/open-scheduled-lesson.png' });
});