export type ActiveProductFlow = {
  id: 'general-signature' | 'past-life-goblin' | 'love-reading' | 'love-reunion' | 'match-couple';
  detailPath: string;
  intakePath: string;
  price: number;
  formKind: 'standard' | 'past-life' | 'love-reading' | 'compatibility';
};

export const activeProductFlows: readonly ActiveProductFlow[] = [
  {
    id: 'general-signature',
    detailPath: '/detail/general-saju',
    intakePath: '/form/general-signature',
    price: 79_000,
    formKind: 'standard'
  },
  {
    id: 'past-life-goblin',
    detailPath: '/detail/past-life-goblin',
    intakePath: '/form/past-life-goblin',
    price: 49_000,
    formKind: 'past-life'
  },
  {
    id: 'love-reading',
    detailPath: '/detail/love-reading',
    intakePath: '/form/love-reading',
    price: 49_000,
    formKind: 'love-reading'
  },
  {
    id: 'love-reunion',
    detailPath: '/detail/love-reunion',
    intakePath: '/form/love-reunion',
    price: 55_000,
    formKind: 'standard'
  },
  {
    id: 'match-couple',
    detailPath: '/detail/match-couple',
    intakePath: '/form/match-couple',
    price: 69_000,
    formKind: 'compatibility'
  }
];

export const customerFixture = {
  name: 'E2E Tester',
  birthDate: '19900115',
  partnerName: 'E2E Partner',
  partnerBirthDate: '19920220',
  questionOne: 'What choice should I prioritize in the next three months?',
  questionTwo: 'What practical habit will help me keep that choice steady?'
} as const;
