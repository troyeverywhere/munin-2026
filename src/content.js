// 팜플렛 내용. 확정되면 이 파일만 고치면 안내소·빔 화면에 함께 반영됩니다.
// [확정 전] 표시가 붙은 항목은 임시 내용입니다.

export const EVENT = {
  date: '2026년 11월 21일 (토)',
  time: '18:00 ~ 20:40',
  place: '[장소 확정 전]',
};

// 식순 (11/5 회의 기준 초안)
export const PROGRAM = [
  { time: '18:00', title: '접수 및 안내', desc: '명찰 받고 자유롭게 앉아 주세요' },
  { time: '18:20', title: '식사', desc: '' },
  { time: '19:10', title: '인사 · 소식나눔 · 럭키드로우', desc: '교수님 인사 (나임교수님 · 신임교수님), 동문 소식나눔, 명찰 번호로 추첨' },
  { time: '19:40', title: '관심사별 네트워킹', desc: '분야별 테이블로 이동해 주세요' },
  { time: '20:30', title: '마무리', desc: '' },
];

// 1부 자리 안내 (세로줄 3개, 느슨한 학번 구분)
export const SEATING = [
  { line: '1번 줄', who: '13학번 이전' },
  { line: '2번 줄', who: '14 ~ 18학번' },
  { line: '3번 줄', who: '19학번 이후' },
];
export function seatFor(gen) {
  if (!/^\d{2}$/.test(gen)) return null;
  const n = +gen;
  if (n <= 13) return SEATING[0];
  if (n <= 18) return SEATING[1];
  return SEATING[2];
}

// 2부 네트워킹 분야 [확정 전]
export const NETWORKING = {
  confirmed: false,
  note: '분야와 모더레이터 소개는 확정되면 올라옵니다.',
  tables: [],
};

export const AFTER = {
  confirmed: false,
  text: '뒤풀이 장소는 예약되면 안내드립니다.',
};

// 후원해 주신 분들 [확정 전]
export const THANKS = {
  confirmed: false,
  note: '후원해 주신 분들의 이름이 이곳에 올라옵니다.',
  funders: [],
  luckyDraw: [],
};
