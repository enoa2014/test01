import { useState, useCallback } from 'react';
import { useCloudbaseContext } from '../providers/CloudbaseProvider';

interface CloudFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export const useCloudFunction = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { app } = useCloudbaseContext();

  const callFunction = useCallback(async <T = any>(
    functionName: string,
    data?: any
  ): Promise<CloudFunctionResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      if (!app) {
        throw new Error('CloudBase 未初始化');
      }

      const result = await app.callFunction({
        name: functionName,
        data
      });

      const response = result.result as CloudFunctionResponse<T>;

      if (!response.success && response.error) {
        setError(response.error.message);
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '云函数调用失败';
      setError(errorMessage);

      return {
        success: false,
        error: {
          code: 'CALL_FUNCTION_ERROR',
          message: errorMessage
        }
      };
    } finally {
      setLoading(false);
    }
  }, [app]);

  return {
    callFunction,
    loading,
    error
  };
};