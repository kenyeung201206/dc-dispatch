/**
 * Google Search Console ownership file, served at exactly /google8ddb948929cb670a.html.
 * (As a plain file in public/, Cloudflare Pages redirects *.html to the address without ".html",
 * and Google's check wants the exact address to answer directly.)
 */
export function onRequestGet(): Response {
  return new Response('google-site-verification: google8ddb948929cb670a.html', {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
