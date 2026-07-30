# MakerOS v1.0.3 Validation

## 확인 항목

- 시험 진입 시 휴대폰·태블릿에서 일반 MakerOS 내비게이션 숨김
- 휴대폰 시험 전용 상단바의 시험명·연도/회차·시간/풀이 현황 표시
- 휴대폰 하단 이전·OMR·다음 버튼 safe-area 대응
- OMR 바텀시트 열기·닫기·필터·문제 이동
- 태블릿 좌측 문제 / 우측 OMR·필기 패널 분할
- 캔버스의 포인터 입력, 펜 색상, 지우개, 전체 지우기
- 연습모드 즉시 채점과 실전모드 제출 로직 유지
- 공식 정답 검증 AI 해설과 자기평가 UI 유지
- JSX 및 JavaScript 구문 검사
- Vite 프로덕션 빌드

## 실행

```powershell
npm.cmd install
npm.cmd run test
npm.cmd run check
npm.cmd run build
npm.cmd run dev
```
