import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useQueryClient } from 'react-query';
import { createAppRouter } from './react.testUtils';

describe('invalidate queries', () => {
  let factory: ReturnType<typeof createAppRouter>;

  beforeEach(() => {
    factory = createAppRouter();
  });

  afterEach(() => {
    factory.close();
  });

  test('queryClient.invalidateQueries()', async () => {
    const {
      App,
      trpc,
      resolvers: { postById, allPosts },
    } = factory;

    function MyComponent() {
      const allPostsQuery = trpc.useQuery(['allPosts'], {
        staleTime: Infinity,
      });
      const postByIdQuery = trpc.useQuery(['postById', '1'], {
        staleTime: Infinity,
      });
      const queryClient = useQueryClient();

      return (
        <>
          <pre>
            allPostsQuery:{allPostsQuery.status} allPostsQuery:
            {allPostsQuery.isStale ? 'stale' : 'not-stale'}{' '}
          </pre>
          <pre>
            postByIdQuery:{postByIdQuery.status} postByIdQuery:
            {postByIdQuery.isStale ? 'stale' : 'not-stale'}
          </pre>
          <button
            data-testid="refetch"
            onClick={() => {
              queryClient.invalidateQueries(['allPosts']);
              queryClient.invalidateQueries(['postById']);
            }}
          />
        </>
      );
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('postByIdQuery:success')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:success')).toBeTruthy();

      expect(screen.findByText('postByIdQuery:not-stale')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:not-stale')).toBeTruthy();

      expect(postById).toBeCalledTimes(1);
      expect(allPosts).toBeCalledTimes(1);
    });

    userEvent.click(screen.getByTestId('refetch'));

    await waitFor(() => {
      expect(screen.findByText('postByIdQuery:stale')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:stale')).toBeTruthy();

      expect(screen.findByText('postByIdQuery:not-stale')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:not-stale')).toBeTruthy();

      expect(postById).toBeCalledTimes(2);
      expect(allPosts).toBeCalledTimes(2);
    });
  });

  xtest('invalidateQueries()', async () => {
    const {
      App,
      trpc,
      resolvers: { postById, allPosts },
    } = factory;

    function MyComponent() {
      const allPostsQuery = trpc.useQuery(['allPosts'], {
        staleTime: Infinity,
      });
      const postByIdQuery = trpc.useQuery(['postById', '1'], {
        staleTime: Infinity,
      });
      const utils = trpc.useContext();
      return (
        <>
          <pre>
            allPostsQuery:{allPostsQuery.status} allPostsQuery:
            {allPostsQuery.isStale ? 'stale' : 'not-stale'}{' '}
          </pre>
          <pre>
            postByIdQuery:{postByIdQuery.status} postByIdQuery:
            {postByIdQuery.isStale ? 'stale' : 'not-stale'}
          </pre>
          <button
            data-testid="refetch"
            onClick={() => {
              utils.invalidateQueries(['allPosts']);
              utils.invalidateQueries(['postById', '1']);
            }}
          />
        </>
      );
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('postByIdQuery:success')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:success')).toBeTruthy();

      expect(screen.findByText('postByIdQuery:not-stale')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:not-stale')).toBeTruthy();

      expect(postById).toBeCalledTimes(1);
      expect(allPosts).toBeCalledTimes(1);
    });

    userEvent.click(screen.getByTestId('refetch'));

    await waitFor(() => {
      expect(screen.findByText('postByIdQuery:stale')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:stale')).toBeTruthy();

      expect(screen.findByText('postByIdQuery:not-stale')).toBeTruthy();
      expect(screen.findByText('allPostsQuery:not-stale')).toBeTruthy();

      expect(postById).toBeCalledTimes(2);
      expect(allPosts).toBeCalledTimes(2);
    });
  });

  test('test invalidateQueries() with different args - flaky', async () => {
    // ref  https://github.com/trpc/trpc/issues/1383
    const { App, trpc } = factory;

    function MyComponent() {
      const countQuery = trpc.useQuery(['count', 'test'], {
        staleTime: Infinity,
      });
      const utils = trpc.useContext();
      return (
        <>
          <pre>count:{countQuery.data}</pre>
          <button
            data-testid="invalidate-1-string"
            onClick={() => {
              utils.invalidateQueries('count');
            }}
          />
          <button
            data-testid="invalidate-2-tuple"
            onClick={() => {
              utils.invalidateQueries(['count']);
            }}
          />
          <button
            data-testid="invalidate-3-exact"
            onClick={() => {
              utils.invalidateQueries(['count', 'test']);
            }}
          />
          <button
            data-testid="invalidate-4-all"
            onClick={() => {
              utils.invalidateQueries();
            }}
          />{' '}
          <button
            data-testid="invalidate-5-predicate"
            onClick={() => {
              utils.invalidateQueries({
                predicate(opts) {
                  const { queryKey } = opts;
                  const [path, input] = queryKey;

                  return path === 'count' && input === 'test';
                },
              });
            }}
          />
        </>
      );
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('count:test:1')).toBeTruthy();
    });
    let count = 1;
    for (const testId of [
      'invalidate-1-string',
      'invalidate-2-tuple',
      'invalidate-3-exact',
      'invalidate-4-all',
      'invalidate-5-predicate',
    ]) {
      count++;
      // click button to invalidate
      userEvent.click(screen.getByTestId(testId));

      // should become stale straight after the click
      await waitFor(() => {
        expect(screen.findByText(`count:test:${count}`)).toBeTruthy();
      });
    }
  });
});
