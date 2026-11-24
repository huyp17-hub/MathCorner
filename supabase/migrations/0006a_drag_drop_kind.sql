-- 0006a_drag_drop_kind.sql — thêm loại câu kéo thả (tách riêng vì enum mới phải commit trước khi dùng)
alter type public.question_kind add value if not exists 'drag_drop';
