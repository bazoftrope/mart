import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MentorIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/mentor/templates');
  }, [router]);

  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/mentor/templates',
      permanent: false,
    },
  };
}
