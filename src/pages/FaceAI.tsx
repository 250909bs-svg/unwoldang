import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent } from 'react';
import { ArrowLeft, Camera, Play, Sparkles, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';

type FaceAreaScore = {
  area: string;
  areaKo: string;
  score: number;
  description: string;
};

type FaceAnalysisResult = {
  totalScore: number;
  faceType: string;
  faceTypeDesc: string;
  areaScores: FaceAreaScore[];
  samjung: { title: string; content: string };
  relationFortune: { title: string; content: string };
  wealthFortune: { title: string; content: string };
  loveFortune: { title: string; content: string };
  destinyPoints: { title: string; content: string };
  celebrity: { name: string; matchScore: number; reason: string };
  overallSummary: string;
};

type CompatibilityResult = {
  overallScore: number;
  summary: string;
  strengths: string[];
  challenges: string[];
  advice: string;
  categories: Array<{ category: string; score: number; description: string }>;
};

const analysisMessages = [
  '얼굴 이미지 분석 준비 중...',
  'AI가 얼굴 특징을 스캔하는 중...',
  '이마, 눈, 코, 입, 턱선의 관상 포인트를 읽는 중...',
  '관계운, 재물운, 연애운 해석을 정리하는 중...',
  '최종 리포트를 다듬는 중...'
] as const;

function createSeed(value: string) {
  return [...value].reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function createFaceResult(seed: number): FaceAnalysisResult {
  const totalScore = 72 + (seed % 21);
  const areaScores: FaceAreaScore[] = [
    {
      area: 'forehead',
      areaKo: '이마',
      score: 70 + ((seed + 3) % 20),
      description: '초년운과 기본 그릇을 보는 자리입니다. 이마선이 단정하게 읽혀 새로운 기회를 받아들이는 힘이 안정적인 편으로 해석됩니다.'
    },
    {
      area: 'eyes',
      areaKo: '눈',
      score: 68 + ((seed + 9) % 23),
      description: '대인관계와 감정 표현을 보는 중심입니다. 눈빛에 온기와 집중력이 함께 보여 신뢰를 주는 인상으로 읽힙니다.'
    },
    {
      area: 'nose',
      areaKo: '코',
      score: 71 + ((seed + 14) % 19),
      description: '재물운과 현실 감각을 보는 핵심 부위입니다. 코 라인이 안정적으로 잡혀 있어 흐름을 꾸준히 쌓는 타입으로 해석됩니다.'
    },
    {
      area: 'mouth',
      areaKo: '입',
      score: 69 + ((seed + 21) % 22),
      description: '말의 기운과 관계의 유연함을 보는 자리입니다. 표현이 부드럽고 호감형으로 이어질 가능성이 높게 읽힙니다.'
    },
    {
      area: 'jaw',
      areaKo: '턱선',
      score: 67 + ((seed + 5) % 24),
      description: '말년운과 버티는 힘을 보는 구간입니다. 턱선이 약하지 않아 결정 후 밀고 가는 추진력이 적당히 살아 있습니다.'
    }
  ];

  const faceTypes = [
    {
      label: '맑은 귀인형',
      desc: '전체적으로 인상이 맑고 정돈된 타입으로 읽힙니다. 처음 보는 사람에게도 호감과 신뢰를 동시에 주는 얼굴이며, 시간이 갈수록 장점이 더 살아나는 관상 흐름입니다.'
    },
    {
      label: '부드러운 재복형',
      desc: '부드러운 결 안에 현실 감각이 살아 있는 타입입니다. 급하게 치고 나가기보다 안정적으로 쌓을수록 재물과 인간관계가 함께 좋아지는 관상으로 해석됩니다.'
    },
    {
      label: '은은한 인기형',
      desc: '과하지 않지만 자꾸 눈에 들어오는 매력이 있는 타입입니다. 겉으로 화려하기보다, 가까워질수록 좋은 인상을 주는 얼굴 흐름이 강합니다.'
    }
  ];

  const pickedType = faceTypes[seed % faceTypes.length];

  return {
    totalScore,
    faceType: pickedType.label,
    faceTypeDesc: pickedType.desc,
    areaScores,
    samjung: {
      title: '삼정 관상 해석',
      content:
        '상정은 맑고 중정은 안정적이며 하정은 무난한 편으로 읽힙니다. 큰 기복보다 꾸준함이 강점인 얼굴이며, 초반보다 중후반에 운이 더 정교하게 살아나는 타입입니다.'
    },
    relationFortune: {
      title: '대인관계 운',
      content:
        '첫인상에서 날카로움보다 편안함이 먼저 전달되는 편입니다. 가까운 사람에게 신뢰를 얻기 쉬우며, 오래 볼수록 호감이 쌓이는 관계운이 강합니다.'
    },
    wealthFortune: {
      title: '재물운',
      content:
        '한 번의 큰 승부보다 안정적으로 쌓는 쪽에서 강점이 보입니다. 지출과 수입의 균형을 의식적으로 유지하면 재물운의 체감이 더 좋아집니다.'
    },
    loveFortune: {
      title: '연애운',
      content:
        '강한 자극형 인연보다, 대화가 편하고 호흡이 맞는 인연에서 좋은 흐름이 열립니다. 급하게 판단하기보다 시간을 두고 알아갈수록 좋은 관계로 이어질 가능성이 높습니다.'
    },
    destinyPoints: {
      title: '운명 포인트',
      content:
        '이 얼굴은 억지로 강하게 보이려 할수록 장점이 줄고, 자연스럽고 정돈된 모습일수록 운이 더 열립니다. 생활 리듬과 표정 관리가 곧 운의 퀄리티를 좌우합니다.'
    },
    celebrity: {
      name: ['수지', '박보검', '한소희', '변우석'][seed % 4],
      matchScore: 78 + (seed % 18),
      reason: '전체적인 분위기와 눈매, 부드러운 인상선에서 닮은 흐름이 감지됩니다.'
    },
    overallSummary:
      '전체적으로 맑고 단정한 인상 안에 현실 감각이 살아 있는 관상입니다. 가까운 사람에게 신뢰와 편안함을 주는 얼굴이며, 생활 루틴이 정리될수록 관계운과 재물운이 함께 안정되는 타입으로 읽힙니다.'
  };
}

function createCompatibilityResult(seed: number): CompatibilityResult {
  return {
    overallScore: 74 + (seed % 20),
    summary:
      '두 얼굴의 인상선은 부딪히기보다 서로 빈 곳을 메워주는 조합으로 읽힙니다. 한쪽은 안정감, 한쪽은 표현력이 살아 있어 잘 맞을 때는 매우 편안한 관계가 될 수 있습니다.',
    strengths: [
      '첫인상에서 주는 에너지의 결이 크게 충돌하지 않아 같이 있을 때 편안함이 생기기 쉽습니다.',
      '한쪽이 말과 표현을 열어주고, 다른 한쪽이 안정감을 잡아주는 구조가 보여 관계 유지력은 좋은 편입니다.'
    ],
    challenges: [
      '피곤할 때는 한쪽이 말을 줄이고 다른 한쪽은 서운함이 커질 수 있어 감정 정리가 필요합니다.',
      '속도 차이가 날 때는 먼저 결론을 내리기보다 대화 템포를 맞추는 것이 중요합니다.'
    ],
    advice:
      '궁합은 강한 자극보다 일상 리듬을 함께 맞출 때 더 좋아집니다. 빠른 판단보다 반복해서 만났을 때 편안한지, 생활 감각이 맞는지를 보세요.',
    categories: [
      {
        category: '첫인상 케미',
        score: 76 + ((seed + 2) % 20),
        description: '처음 만났을 때의 끌림과 호기심 흐름이 무난하게 좋은 편입니다.'
      },
      {
        category: '감정 호흡',
        score: 71 + ((seed + 7) % 22),
        description: '감정 표현 속도는 다를 수 있지만 대화가 풀리면 금방 안정되는 타입입니다.'
      },
      {
        category: '생활 밸런스',
        score: 74 + ((seed + 11) % 18),
        description: '같이 시간을 보낼수록 생활 패턴을 맞춰갈 수 있는 여지가 보입니다.'
      }
    ]
  };
}

export default function FaceAI() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [partnerFile, setPartnerFile] = useState<File | null>(null);
  const [partnerPreview, setPartnerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [result, setResult] = useState<FaceAnalysisResult | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      if (partnerPreview) {
        URL.revokeObjectURL(partnerPreview);
      }
    };
  }, [imagePreview, partnerPreview]);

  const starCount = 24;
  const canAnalyze = Boolean(imageFile) && !loading;
  const cardAccent = useMemo(() => (result ? `${result.totalScore}%` : '0%'), [result]);

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setCompatibility(null);
    setIsUnlocked(false);
    setIsUnlocking(false);
  };

  const handlePartnerUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (partnerPreview) {
      URL.revokeObjectURL(partnerPreview);
    }

    setPartnerFile(file);
    setPartnerPreview(URL.createObjectURL(file));
    setCompatibility(null);
    setIsUnlocked(false);
    setIsUnlocking(false);
  };

  const handleAnalyze = () => {
    if (!imageFile) {
      return;
    }

    setLoading(true);
    setLoadingProgress(8);
    setLoadingText(analysisMessages[0]);
    setResult(null);
    setCompatibility(null);
    setIsUnlocked(false);
    setIsUnlocking(false);

    const baseSeed = createSeed(`${imageFile.name}-${imageFile.size}-${imageFile.lastModified}`);
    const partnerSeed = partnerFile ? createSeed(`${partnerFile.name}-${partnerFile.size}-${partnerFile.lastModified}`) : 0;
    const finalSeed = baseSeed + partnerSeed;

    const messageTimer = window.setInterval(() => {
      setLoadingText((prev) => {
        const currentIndex = analysisMessages.indexOf(prev as (typeof analysisMessages)[number]);
        return analysisMessages[Math.min(currentIndex + 1, analysisMessages.length - 1)];
      });
    }, 800);

    const progressTimer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        const nextValue = Math.min(prev + 13, 93);
        return nextValue;
      });
    }, 330);

    window.setTimeout(() => {
      window.clearInterval(messageTimer);
      window.clearInterval(progressTimer);
      setLoading(false);
      setLoadingProgress(100);
      setLoadingText('분석 완료!');
      setResult(createFaceResult(finalSeed));
      setCompatibility(partnerFile ? createCompatibilityResult(finalSeed) : null);
    }, 2600);
  };

  const handleUnlock = () => {
    if (isUnlocked || isUnlocking) {
      return;
    }

    setIsUnlocking(true);

    window.setTimeout(() => {
      setIsUnlocking(false);
      setIsUnlocked(true);
    }, 760);
  };

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="AI 관상 분석" backTo="/test" backLabel="테스트" />

        <section className="mobile-page-content face-ai-page">
          <section className="face-ai-banner">
            <div className="face-ai-banner-copy">
              <span className="face-ai-soft-chip">
                <Sparkles size={14} />
                AI 관상 전문가 리포트
              </span>
              <h1>
                사진 한 장으로 보는
                <br />
                실제 AI 관상 · 운세 · 궁합 분석
              </h1>
              <p>이마, 눈, 코, 입술, 턱선을 기준으로 관상 포인트를 읽고 연애운, 재물운, 관계운까지 한 번에 정리합니다.</p>

              <div className="face-ai-hero-chips" aria-label="분석 범위">
                <span>연애운</span>
                <span>재물운</span>
                <span>관상 궁합</span>
              </div>
            </div>

            <div className="face-ai-star-balance">
              <Star size={14} />
              <strong>{starCount}개</strong>
            </div>
          </section>

          <section className="face-ai-card">
            <div className="face-ai-card-head">
              <div>
                <h2>1. 얼굴 사진 업로드</h2>
                <p>정면 셀카, 얼굴이 선명한 사진일수록 분석 정확도가 더 좋아집니다.</p>
              </div>
            </div>

            <div className="face-ai-upload-stack">
              <div className="face-ai-upload-block">
                <p className="face-ai-upload-label">
                  <Camera size={14} />
                  내 얼굴 사진
                </p>
                <label className="face-ai-dropzone">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="내 얼굴 미리보기" className="face-ai-preview-image" />
                      <span>다시 눌러서 사진 변경</span>
                    </>
                  ) : (
                    <>
                      <span className="face-ai-drop-icon mine">
                        <Camera size={24} />
                      </span>
                      <strong>내 얼굴 사진 업로드</strong>
                      <p>얼굴이 선명할수록 분석 정확도가 올라가요</p>
                    </>
                  )}
                  <input type="file" accept="image/*" className="sr-only" onChange={handleUpload} />
                </label>
              </div>

              <div className="face-ai-upload-block">
                <p className="face-ai-upload-label">
                  <Users size={14} />
                  상대 얼굴 사진(선택)
                </p>
                <label className="face-ai-dropzone secondary">
                  {partnerPreview ? (
                    <>
                      <img src={partnerPreview} alt="상대 얼굴 미리보기" className="face-ai-preview-image compact" />
                      <span>다시 눌러서 변경</span>
                    </>
                  ) : (
                    <>
                      <span className="face-ai-drop-icon partner">
                        <Users size={22} />
                      </span>
                      <strong>상대 사진 추가하기</strong>
                      <p>넣으면 관상 궁합까지 함께 보여드려요</p>
                    </>
                  )}
                  <input type="file" accept="image/*" className="sr-only" onChange={handlePartnerUpload} />
                </label>
              </div>
            </div>

            <button type="button" className="app-black-button face-ai-primary-button" disabled={!canAnalyze} onClick={handleAnalyze}>
              {loading ? 'AI가 관상을 분석 중...' : partnerFile ? '두 얼굴 같이 스캔하기' : 'AI 관상 스캔 시작'}
            </button>

            <p className="face-ai-disclaimer">
              ※ 이 분석 결과는 오락과 자기 탐색 목적의 UI 데모입니다.
              <br />
              ※ 업로드한 사진은 브라우저 미리보기용으로만 사용됩니다.
            </p>
          </section>

          <section className="face-ai-card">
            <div className="face-ai-card-head">
              <div>
                <h2>2. AI 관상 분석 결과</h2>
                <p>사진을 올리고 스캔하면 실제 운월당처럼 카드형 리포트가 생성됩니다.</p>
              </div>
            </div>

            {!result && !loading ? (
              <div className="face-ai-empty-state">
                <span>
                  <Sparkles size={26} />
                </span>
                <strong>아직 분석 전이에요</strong>
                <p>얼굴 사진을 업로드하고 스캔을 시작해 주세요.</p>
              </div>
            ) : null}

            {loading ? (
              <div className="face-ai-loading-card">
                <div className="face-ai-loading-visual" aria-hidden="true">
                  <span className="face-ai-loading-orb orb-a" />
                  <span className="face-ai-loading-orb orb-b" />
                  <span className="face-ai-loading-scanline" />
                </div>
                <span className="face-ai-loading-icon">
                  <Sparkles size={24} />
                </span>
                <strong>AI가 관상을 분석하는 중...</strong>
                <p>{loadingText}</p>
                <div className="face-ai-progress-track">
                  <span style={{ width: `${loadingProgress}%` }} />
                </div>
              </div>
            ) : null}

            {result ? (
              <div className="face-ai-report-stack">
                <article className="face-ai-score-card face-ai-reveal-card" style={{ ['--face-score' as string]: cardAccent, ['--reveal-index' as string]: 0 } as CSSProperties}>
                  <div>
                    <p>오늘의 관상 총점</p>
                    <strong>{result.faceType}</strong>
                  </div>
                  <div className="face-ai-score-value">
                    <span>{result.totalScore}</span>
                    <small>/ 100</small>
                  </div>
                </article>

                <p className="face-ai-body-copy">{result.faceTypeDesc}</p>

                <article className="face-ai-section-card face-ai-reveal-card" style={{ ['--reveal-index' as string]: 1 } as CSSProperties}>
                  <div className="face-ai-section-headline">
                    <strong>부위별 얼굴 점수</strong>
                    <span>점수 높을수록 해당 부위의 기운이 안정적인 편입니다.</span>
                  </div>

                  <div className="face-ai-area-stack">
                    {result.areaScores.map((part, index) => (
                      <div key={part.area} className="face-ai-area-row" style={{ ['--area-index' as string]: index } as CSSProperties}>
                        <div className="face-ai-area-topline">
                          <span>{part.areaKo}</span>
                          <strong>{part.score}점</strong>
                        </div>
                        <div className="face-ai-area-track">
                          <span style={{ width: `${part.score}%` }} />
                        </div>
                        <p>{part.description}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <div className={isUnlocked ? 'face-ai-lock-shell unlocked' : isUnlocking ? 'face-ai-lock-shell unlocking' : 'face-ai-lock-shell'}>
                  <div className={isUnlocked ? 'face-ai-detail-stack' : 'face-ai-detail-stack blurred'}>
                    <article className="face-ai-tone-card soft face-ai-reveal-card" style={{ ['--reveal-index' as string]: 2 } as CSSProperties}>
                      <strong>{result.samjung.title}</strong>
                      <p>{result.samjung.content}</p>
                    </article>

                    <article className="face-ai-tone-card blue face-ai-reveal-card" style={{ ['--reveal-index' as string]: 3 } as CSSProperties}>
                      <strong>{result.relationFortune.title}</strong>
                      <p>{result.relationFortune.content}</p>
                    </article>

                    <article className="face-ai-tone-card amber face-ai-reveal-card" style={{ ['--reveal-index' as string]: 4 } as CSSProperties}>
                      <strong>{result.wealthFortune.title}</strong>
                      <p>{result.wealthFortune.content}</p>
                    </article>

                    <article className="face-ai-tone-card pink face-ai-reveal-card" style={{ ['--reveal-index' as string]: 5 } as CSSProperties}>
                      <strong>{result.loveFortune.title}</strong>
                      <p>{result.loveFortune.content}</p>
                    </article>

                    <article className="face-ai-tone-card violet face-ai-reveal-card" style={{ ['--reveal-index' as string]: 6 } as CSSProperties}>
                      <strong>{result.destinyPoints.title}</strong>
                      <p>{result.destinyPoints.content}</p>
                    </article>

                    <article className="face-ai-celebrity-card face-ai-reveal-card" style={{ ['--reveal-index' as string]: 7 } as CSSProperties}>
                      <div>
                        <span>닮은 연예인</span>
                        <strong>{result.celebrity.name}</strong>
                        <p>{result.celebrity.reason}</p>
                      </div>
                      <div className="face-ai-celebrity-score">
                        <strong>{result.celebrity.matchScore}%</strong>
                        <span>유사도</span>
                      </div>
                    </article>

                    <article className="face-ai-summary-card face-ai-reveal-card" style={{ ['--reveal-index' as string]: 8 } as CSSProperties}>
                      <strong>종합 평가</strong>
                      <p>{result.overallSummary}</p>
                    </article>

                    {compatibility ? (
                      <article className="face-ai-compatibility-card face-ai-reveal-card" style={{ ['--reveal-index' as string]: 9 } as CSSProperties}>
                        <div className="face-ai-compatibility-head">
                          <div>
                            <strong>관상 궁합 리포트</strong>
                            <p>{compatibility.summary}</p>
                          </div>
                          <div className="face-ai-score-bubble">{compatibility.overallScore}점</div>
                        </div>

                        <div className="face-ai-compatibility-columns">
                          <div>
                            <h3>강점</h3>
                            {compatibility.strengths.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                          <div>
                            <h3>주의할 점</h3>
                            {compatibility.challenges.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                        </div>

                        <div className="face-ai-advice-box">
                          <strong>함께 성장하기 위한 조언</strong>
                          <p>{compatibility.advice}</p>
                        </div>

                        <div className="face-ai-category-scores">
                          {compatibility.categories.map((item, index) => (
                            <div key={item.category} className="face-ai-area-row compact" style={{ ['--area-index' as string]: index + 5 } as CSSProperties}>
                              <div className="face-ai-area-topline">
                                <span>{item.category}</span>
                                <strong>{item.score}점</strong>
                              </div>
                              <div className="face-ai-area-track">
                                <span style={{ width: `${item.score}%` }} />
                              </div>
                              <p>{item.description}</p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : null}
                  </div>

                  {!isUnlocked ? (
                    <div className="face-ai-lock-overlay">
                      <div className="face-ai-lock-badge">🔒</div>
                      <strong>{isUnlocking ? '상세 리포트를 여는 중...' : '상세 분석 전체 리포트'}</strong>
                      <p>
                        {isUnlocking
                          ? '관상 카드와 궁합 카드가 한 장씩 펼쳐지도록 잠금 애니메이션을 실행하고 있습니다.'
                          : '실사이트 구조처럼 하단 리포트는 한 번 더 열람 액션을 거치도록 구성했습니다.'}
                      </p>
                      <button type="button" className="app-black-button" onClick={handleUnlock} disabled={isUnlocking}>
                        <Star size={14} />
                        {isUnlocking ? '리포트 펼치는 중...' : '무료로 전체 리포트 열기'}
                      </button>
                      <span className="face-ai-lock-help">
                        <Play size={12} />
                        디자인 확인용으로 지금은 바로 열 수 있게 해두었습니다.
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <div className="face-ai-bottom-link">
            <Link to="/test" className="app-muted-button with-icon-row">
              <ArrowLeft size={16} />
              테스트 연구소로 돌아가기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
