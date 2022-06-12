import '@testing-library/jest-dom';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { expectTypeOf } from 'expect-type';
import React, { useEffect, useState } from 'react';
import { createAppRouter } from './react.testUtils';

describe('useMutation()', () => {
  let factory: ReturnType<typeof createAppRouter>;

  beforeEach(() => {
    factory = createAppRouter();
  });

  afterEach(() => {
    factory.close();
  });

  test('call procedure with no input with null/undefined', async () => {
    const { trpc, App } = factory;

    const results: unknown[] = [];
    function MyComponent() {
      const mutation = trpc.useMutation('PING');
      const [finished, setFinished] = useState(false);

      useEffect(() => {
        (async () => {
          await new Promise((resolve) =>
            mutation.mutate(null, {
              onSettled: resolve,
            }),
          );
          await new Promise((resolve) =>
            mutation.mutate(undefined, {
              onSettled: resolve,
            }),
          );

          await mutation.mutateAsync(null);

          await mutation.mutateAsync(undefined);
          setFinished(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      useEffect(() => {
        results.push(mutation.data);
      }, [mutation.data]);

      return (
        <pre>
          {JSON.stringify(mutation.data ?? {}, null, 4)}
          {finished && '__IS_FINISHED__'}
        </pre>
      );
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('__IS_FINISHED__')).toBeTruthy();
    });
  });

  test('nullish input called with no input', async () => {
    const { trpc, App } = factory;

    const query = renderHook(() => trpc.useQuery(['allPosts']), {
      wrapper: App,
    });
    const mutation = renderHook(() => trpc.useMutation('deletePosts'), {
      wrapper: App,
    });

    await act(async () => {
      await query.result.current.refetch();
    });

    await waitFor(() => {
      expect(query.result.current.data).toHaveLength(2);
    });

    await act(async () => {
      await mutation.result.current.mutateAsync();
      await query.result.current.refetch();
    });

    await waitFor(() => {
      expect(query.result.current.data).toHaveLength(0);
    });
  });

  test('useMutation([path]) tuple', async () => {
    const { trpc, App } = factory;

    const query = renderHook(() => trpc.useQuery(['allPosts']), {
      wrapper: App,
    });
    const mutation = renderHook(() => trpc.useMutation(['deletePosts']), {
      wrapper: App,
    });

    await act(async () => {
      await query.result.current.refetch();
    });

    await waitFor(() => {
      expect(query.result.current.data).toHaveLength(2);
    });

    await act(async () => {
      await mutation.result.current.mutateAsync();
      await query.result.current.refetch();
    });

    await waitFor(() => {
      expect(query.result.current.data).toHaveLength(0);
    });
  });

  test('nullish input called with input', async () => {
    const { trpc, App } = factory;

    const query = renderHook(() => trpc.useQuery(['allPosts']), {
      wrapper: App,
    });
    const mutation = renderHook(() => trpc.useMutation(['deletePosts']), {
      wrapper: App,
    });

    await act(async () => {
      await query.result.current.refetch();
    });

    await waitFor(() => {
      expect(query.result.current.data).toHaveLength(2);
    });

    await act(async () => {
      await mutation.result.current.mutateAsync(['1']);
      await query.result.current.refetch();
    });

    await waitFor(() => {
      expect(query.result.current.data).toHaveLength(1);
    });
  });

  test('useMutation with context', async () => {
    const { App, trpc, linkSpy } = factory;

    function MyComponent() {
      const deletePostsMutation = trpc.useMutation(['deletePosts'], {
        context: {
          test: '1',
        },
      });

      useEffect(() => {
        deletePostsMutation.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <pre>{deletePostsMutation.isSuccess && '___FINISHED___'}</pre>;
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('___FINISHED___')).toBeTruthy();
    });

    await waitFor(() => {
      expect(linkSpy.up).toHaveBeenCalledTimes(1);
      expect(linkSpy.down).toHaveBeenCalledTimes(1);
      expect(linkSpy.up.mock.calls[0][0].context).toMatchObject({
        test: '1',
      });
    });
  });

  test('useMutation with mutation context', async () => {
    const { App, trpc } = factory;

    function MyComponent() {
      trpc.useMutation(['deletePosts'], {
        onMutate: () => 'foo' as const,
        onSuccess: (_data, _variables, context) => {
          expectTypeOf(context).toMatchTypeOf<'foo'>();
        },
        onError: (_error, _variables, context) => {
          expectTypeOf(context).toMatchTypeOf<'foo' | undefined>();
        },
        onSettled: (_data, _error, _variables, context) => {
          expectTypeOf(context).toMatchTypeOf<'foo' | undefined>();
        },
      });

      return null;
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );
  });
});
