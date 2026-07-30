# MakerOS v1.0.2 Responsive Release

## 핵심 변경

- 태블릿에서 햄버거 메뉴와 슬라이드형 전체 메뉴 제공
- 휴대폰에서 홈·학습·검색·더보기 하단 빠른 메뉴 제공
- CBT 답안지를 휴대폰용 하단 시트로 전환
- 문제 풀이 하단 이동 버튼을 모바일 안전 영역 위에 고정
- 과목·주제·모의고사·학습 코치·PDF·AI Tutor·프로젝트·포트폴리오 화면의 그리드 자동 재배치
- 긴 탭과 필터를 가로 스크롤 방식으로 변경
- 표와 관리자 데이터 화면의 모바일 가로 스크롤 지원
- 모달을 휴대폰에서 하단 시트 형태로 표시
- iPhone 안전 영역과 동적 뷰포트 높이 대응
- 키보드 포커스와 모션 감소 설정 지원

## 기준 화면 폭

- 데스크톱: 1081px 이상
- 태블릿: 761px~1080px
- 휴대폰: 481px~760px
- 소형 휴대폰: 320px~480px

## 확인 명령

```powershell
npm.cmd run test:responsive
npm.cmd run check
npm.cmd run build
npm.cmd run dev
```
