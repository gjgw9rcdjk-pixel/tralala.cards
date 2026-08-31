import HomeBody from '../HomeBody';
import { buildMetadata, buildJsonLd } from '@/lib/seo';

export const metadata = buildMetadata('es');

const jsonLd = buildJsonLd('es');

export default function HomeEs() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeBody lang="es" />
    </>
  );
}
