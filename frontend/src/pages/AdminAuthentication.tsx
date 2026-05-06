import { AccessSecurityModule } from './admin/AccessSecurityModule';

export function AdminAuthentication() {
  return <AccessSecurityModule view="authentication" />;
}
