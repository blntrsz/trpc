/* eslint-disable @typescript-eslint/no-non-null-assertion */
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { expectTypeOf } from 'expect-type';
import React from 'react';
import { Post, createAppRouter } from './react.testUtils';

describe('useQuery()', () => {
  let factory: ReturnType<typeof createAppRouter>;

  beforeEach(() => {
    factory = createAppRouter();
  });

  afterEach(() => {
    factory.close();
  });

  test('no input', async () => {
    const { trpc, App } = factory;
    function MyComponent() {
      const allPostsQuery = trpc.useQuery(['allPosts']);
      expectTypeOf(allPostsQuery.data!).toMatchTypeOf<Post[]>();

      return <pre>{JSON.stringify(allPostsQuery.data ?? 'n/a', null, 4)}</pre>;
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('first post')).toBeTruthy();
    });
  });

  test('with operation context', async () => {
    const { trpc, App, linkSpy } = factory;

    function MyComponent() {
      const allPostsQuery = trpc.useQuery(['allPosts'], {
        context: {
          test: '1',
        },
      });
      expectTypeOf(allPostsQuery.data!).toMatchTypeOf<Post[]>();

      return <pre>{JSON.stringify(allPostsQuery.data ?? 'n/a', null, 4)}</pre>;
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('first post')).toBeTruthy();
    });

    await waitFor(() => {
      expect(linkSpy.up).toHaveBeenCalledTimes(1);
      expect(linkSpy.down).toHaveBeenCalledTimes(1);
      expect(linkSpy.up.mock.calls[0][0].context).toMatchObject({
        test: '1',
      });
    });
  });

  test('with input', async () => {
    const { trpc, App } = factory;

    function MyComponent() {
      const allPostsQuery = trpc.useQuery(['paginatedPosts', { limit: 1 }]);

      return <pre>{JSON.stringify(allPostsQuery.data ?? 'n/a', null, 4)}</pre>;
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('first post')).toBeTruthy();
    });
    expect(screen.queryByText('second post')).toBeFalsy();
  });

  test('select fn', async () => {
    const { trpc, App } = factory;

    function MyComponent() {
      const allPostsQuery = trpc.useQuery(['paginatedPosts', { limit: 1 }], {
        select: () => ({
          hello: 'world' as const,
        }),
      });
      expectTypeOf(allPostsQuery.data!).toMatchTypeOf<{ hello: 'world' }>();

      return <pre>{JSON.stringify(allPostsQuery.data ?? 'n/a', null, 4)}</pre>;
    }

    render(
      <App>
        <MyComponent />
      </App>,
    );

    await waitFor(() => {
      expect(screen.findByText('"hello": "world"')).toBeTruthy();
    });
  });
});
