# Changelog

## v0.4.0

- 자격증별 CBT 과목 상태 수정
  - 현재 선택한 자격증의 기출문제만 읽어 실제 과목명을 자동 구성
  - 전기이론·전기기기 등 고정 예시 과목 제거
  - 자격증별로 과목 선택 상태를 별도 저장
  - 과목별 학습량·풀이 수·정답률을 실제 CBT 기록으로 계산
- CBT와 PDF Learning Tree의 화면 문맥 분리
  - 자격증 CBT 화면에서만 현재 자격증 배지 표시
  - PDF Learning Tree에서는 `PDF 독립 학습` 문맥을 별도로 표시
  - PDF를 자동 선택하지 않고 사용자가 명시적으로 선택하도록 변경
  - PDF ID를 기준으로 트리·AI 노트·단어카드를 엄격하게 분리
  - 기존 혼합 캐시를 사용하지 않도록 Learning Tree 캐시 버전 갱신
- AI Tutor 안정화
  - 빈 응답·HTML 오류 응답을 그대로 JSON 파싱하지 않도록 수정
  - 기술적인 `Unexpected end of JSON input` 문구 대신 사용자용 오류 안내 제공
  - 현재 자격증 CBT 또는 특정 PDF를 참고 범위로 선택하는 기능 추가
  - PDF 요약 질문에는 문서 전 범위에서 균등하게 선택한 페이지와 해당 PDF의 AI 노트·카드만 전달
  - Learning Tree에서 AI Tutor로 이동할 때 현재 PDF ID와 질문을 함께 전달

## v0.3.0

- 진로 화면을 Maker Type 기반으로 재설계
- 긴 PDF 학습 자료 생성 구조 개선
- PDF 학습과 자격증 CBT 분리
- CBT 과목별 구분 강화
- PDF ID별 Learning Tree 캐시 적용

## v0.2.0

- Invent에 GPT 서랍형 아이디어 보관함 추가
- Build에 프로젝트 보관함과 프로젝트 일지 추가
- Portfolio를 이력서 중심 구조로 개편

## v0.5.0
- 자격증 분야 필터 버튼을 실제 데이터 필터와 연결
- 분야별 자격증 수, 검색 초기화, 빈 결과 안내 추가
- 진로 직무 버튼에 상세 가이드와 Learn·Invent·Portfolio 이동 연결
- PDF Learning Tree의 관련 AI 노트·단어카드 버튼을 실제 자료 위치와 연결
- 현재 CBT 탭 버튼을 비활성 상태로 표시해 가짜 상호작용 제거
- 클릭 가능한 버튼의 포커스·모바일 UI 개선

## v0.6.0 Deploy Ready
- Vite 빌드 결과물을 Express에서 직접 제공하는 통합 배포 구조 추가
- React 라우트 새로고침 시 index.html로 연결되는 SPA fallback 추가
- Render Blueprint용 render.yaml 추가
- Dockerfile 및 .dockerignore 추가
- /api/health 상태 확인 API 추가
- Render PORT 및 0.0.0.0 바인딩 지원
- 허용 출처를 환경변수로 제한할 수 있는 CORS 설정 추가
- 정적 자산 장기 캐시 및 기본 오류 응답 추가
- 배포 환경변수 예시와 Render 배포 가이드 추가
