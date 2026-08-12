import { Alert } from 'app/components/Alert';
import { AuthorizationStatus } from 'app/constants';
import { getUserInfoByToken } from 'app/slice/thunks';
import { StorageKeys } from 'globalConstants';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import persistence from 'utils/persistence';

export const AuthorizationPage = () => {
  const [status, setStatus] = useState<AuthorizationStatus>(
    AuthorizationStatus.Initialized,
  );
  const [errorMessage, setErrorMessage] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('authorization_token');
    const errorMessage = searchParams.get('error_message');
    const redirectUrl = searchParams.get('redirect_url');

    if (token) {
      setStatus(AuthorizationStatus.Pending);
      const authorizationToken = token.startsWith('Bearer ')
        ? token
        : `Bearer ${token}`;

      dispatch(
        getUserInfoByToken({
          token: authorizationToken,
          resolve: () => {
            // share page oauth login redirect
            const sessionRedirectUrl = persistence.session.get(
              StorageKeys.AuthRedirectUrl,
            );
            if (isSafeRedirectUrl(redirectUrl)) {
              navigate(redirectUrl, { replace: true });
            } else if (sessionRedirectUrl) {
              persistence.session.remove(StorageKeys.AuthRedirectUrl);
              window.location.href = sessionRedirectUrl;
            } else {
              navigate('/', { replace: true });
            }
          },
          reject: () => {
            setStatus(AuthorizationStatus.Error);
          },
        }),
      );
    }

    if (errorMessage) {
      setStatus(AuthorizationStatus.Error);
      setErrorMessage(errorMessage);
    }
  }, [dispatch, navigate]);

  return <Alert status={status} errorMessage={errorMessage} />;
};

function isSafeRedirectUrl(url: string | null): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}
