import { useNavigate } from 'react-router-dom';
export const useToScheduleDetails = () => {
  const navigate = useNavigate();
  return {
    toDetails: (orgId: string, scheduleId?: string) => {
      if (scheduleId) {
        navigate(`/organizations/${orgId}/schedules/${scheduleId}`);
      } else {
        navigate(`/organizations/${orgId}/schedules`, { replace: true });
      }
    },
  };
};
