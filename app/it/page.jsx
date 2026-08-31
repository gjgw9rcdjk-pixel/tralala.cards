import HomeBody from '../HomeBody';
import { buildMetadata, buildJsonLd } from '@/lib/seo';

export const metadata = buildMetadata('it');

const jsonLd = buildJsonLd('it');

export default function HomeIt() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeBody lang="it" />
    </>
  );
}
