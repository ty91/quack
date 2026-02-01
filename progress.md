# quack 구현 진행 계획

> 시니어 개발자 기준 phase당 30~60분 분량
> 지침: 각 phase 완료 시 `[x]`로 변경
> 지침: 각 phase 완료 시 Git commit 작성 (Conventional Commits)

## [x] Phase 1: 프로젝트 스캐폴딩 + CLI 뼈대
- 목표: 실행 가능한 CLI 골격, 기본 명령 라우팅
- 작업
  - TS 프로젝트 초기화, lint/test 최소 구성
  - commander 기반 CLI 엔트리
  - `quack --help`, `quack config show` 스텁
- 테스트 시나리오
  - `quack --help` 정상 출력
  - `quack config show` 0 exit
- 성공 조건
  - CLI 실행 가능, 도움말/기본 커맨드 동작

## [x] Phase 2: config 로더/머지/검증
- 목표: TOML 로드 + 기본값 + CLI override
- 작업
  - config 스키마 정의
  - defaults/merge/validation 구현
  - `config init/show` 출력
- 테스트 시나리오
  - TOML 파일 로드/병합
  - 잘못된 필드 에러 처리
- 성공 조건
  - config 규칙 일관, 에러 메시지 명확

## [ ] Phase 3: 스토리지 스키마 + DB 레이어
- 목표: SQLite/FTS 스키마 적용, 리포지토리 기본 CRUD
- 작업
  - schema 생성/마이그레이션
  - sources/files/chunks/fts/embeddings CRUD
- 테스트 시나리오
  - 스키마 생성/재실행 idempotent
  - UNIQUE/FK 제약 동작
- 성공 조건
  - DB 부팅 안정, 기본 쿼리 성공

## [ ] Phase 4: 커넥터 레지스트리 + 파일 시스템 커넥터
- 목표: 커넥터 인터페이스, file-system 구현
- 작업
  - connector registry/타입 정의
  - file-system: 스캔/메타/읽기
  - ingestion 기본값 적용(필터/인코딩)
- 테스트 시나리오
  - fixture 폴더 스캔 결과 일치
  - 제외 규칙/인코딩 실패 처리
- 성공 조건
  - 문서 리스트/본문 추출 정상

## [ ] Phase 5: 청킹/임베딩 파이프라인 (mock)
- 목표: chunk 생성 + 임베딩 저장 파이프라인
- 작업
  - token chunker 구현
  - mock embedding provider
  - embeddings/벡터 매핑 저장
- 테스트 시나리오
  - chunk 길이/overlap 규칙
  - 최소 토큰 drop
- 성공 조건
  - 청킹 결과 안정, mock 임베딩 저장

## [ ] Phase 6: 벡터 인덱스(HNSW) + BM25 후보 검색
- 목표: hybrid 후보 생성 단계
- 작업
  - HNSW 래퍼 구현
  - FTS5 BM25 검색 쿼리
  - 후보 합치기 전 각 단계 반환
- 테스트 시나리오
  - 벡터 인덱스 삽입/검색
  - FTS 검색 결과 필터(is_deleted)
- 성공 조건
  - bm25 + vector 후보 확보

## [ ] Phase 7: Mixer(RRF) + Reranker(transformers.js) 결합
- 목표: 랭킹 파이프라인 완료
- 작업
  - RRF mixer 구현
  - transformers.js reranker provider
  - 최종 Top-N 반환
- 테스트 시나리오
  - RRF 스코어 합산 일관
  - rerank 결과 순서 변화 확인
- 성공 조건
  - end-to-end 검색 결과 생성

## [ ] Phase 8: Sync 명령 통합 + CLI 출력 포맷
- 목표: `source sync/search` 통합 동작
- 작업
  - sync 플로우 구현 (hash+mtime)
  - soft-delete 처리
  - md/text/json formatter
- 테스트 시나리오
  - 신규/변경/삭제 파일 sync
  - 출력 포맷 스냅샷
- 성공 조건
  - CLI에서 실제 검색 결과 출력

## [ ] Phase 9: Bear/Obsidian 커넥터(읽기 전용)
- 목표: 확장 커넥터 지원
- 작업
  - Bear DB 읽기(경로 config)
  - Obsidian vault 스캔
- 테스트 시나리오
  - fixture 기반 read
  - 예외 경로/권한 에러
- 성공 조건
  - 커넥터 등록/스캔 동작

## [ ] Phase 10: 품질/문서화/에러 코드
- 목표: 안정성/사용성 마무리
- 작업
  - exit code 규칙 정의
  - 에러 메시지 표준화
  - README 업데이트
- 테스트 시나리오
  - 실패 케이스 exit code 검증
  - 도움말/사용 예시 확인
- 성공 조건
  - 사용자 흐름 문서화 완료
