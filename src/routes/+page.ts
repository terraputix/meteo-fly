import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import type { PageLoad } from './$types';
import { getLastVisitedURL } from '$lib/services/storage';

export const load: PageLoad = ({ url }) => {
  if (!browser) return;

  const hasURLParams = url.searchParams.toString() !== '';

  if (!hasURLParams) {
    const lastURL = getLastVisitedURL();
    if (lastURL) {
      console.log('Redirecting to last visited URL.');
      throw redirect(307, lastURL);
    }
  }
};
