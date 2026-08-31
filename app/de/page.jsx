import HomeBody from '../HomeBody';
import { buildMetadata, buildJsonLd } from '@/lib/seo';

export const metadata = buildMetadata('de');

const jsonLd = buildJsonLd('de');

export default function HomeDe() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeBody lang="de" />
    </>
  );
}
