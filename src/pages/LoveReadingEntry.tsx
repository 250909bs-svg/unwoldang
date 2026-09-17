import MobileTopBar from '../components/MobileTopBar';
import LoveReadingIntro from '../components/LoveReadingIntro';
import '../styles/mz-love-fact.css';

export default function LoveReadingEntry() {
  return (
    <main className="mz-love-landing mz-love-entry-only">
      <MobileTopBar title="운월당" />
      <LoveReadingIntro />
    </main>
  );
}
