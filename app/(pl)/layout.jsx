import RootShell, { rootMetadata, rootViewport } from '../RootShell';

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function Layout({ children }) {
  return <RootShell lang="pl">{children}</RootShell>;
}
