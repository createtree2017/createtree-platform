-- Create music_styles table manually
CREATE TABLE IF NOT EXISTS music_styles (
  id SERIAL PRIMARY KEY,
  style_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  prompt TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default music styles
INSERT INTO music_styles (style_id, name, description, prompt, "order", is_active) VALUES
  ('lullaby', '자장가', '부드럽고 편안한 자장가 스타일의 음악', 'gentle lullaby with soft piano melody, peaceful and calming', 1, true),
  ('piano', '피아노', '감성적인 피아노 연주 음악', 'emotional piano ballad, expressive and touching', 2, true),
  ('acoustic', '어쿠스틱', '따뜻한 어쿠스틱 기타 음악', 'warm acoustic guitar melody, folk style, heartwarming', 3, true),
  ('classical', '클래식', '고전적인 클래식 음악 스타일', 'classical orchestral piece, elegant and sophisticated', 4, true),
  ('meditation', '명상', '명상과 휴식을 위한 음악', 'meditation music, ambient, peaceful and serene', 5, true)
ON CONFLICT (style_id) DO NOTHING;