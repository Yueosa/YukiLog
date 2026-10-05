const isAdmin = window.location.pathname.startsWith('/admin');

export {};

if (isAdmin) {
  await import('./admin/admin-app.js');
  document.body.append(document.createElement('yuki-admin'));
} else {
  await import('./ui/yuki-app.js');
  document.body.append(document.createElement('yuki-app'));
}
