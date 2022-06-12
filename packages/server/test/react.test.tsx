/* eslint-disable @typescript-eslint/no-empty-function */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/* eslint-disable @typescript-eslint/ban-types */

/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/ban-ts-comment */
import '@testing-library/jest-dom';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectTypeOf } from 'expect-type';
import { AppType } from 'next/dist/shared/lib/utils';
import React, { Fragment, useEffect, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  setLogger,
  useQueryClient,
} from 'react-query';
import { withTRPC } from '../../next/src';
import { createSSGHelpers } from '../../react/ssg';
import { DefaultErrorShape } from '../src';
import { Post, createAppRouter } from './react.testUtils';

setLogger({
  log() {},
  warn() {},
  error() {},
});

let factory: ReturnType<typeof createAppRouter> = createAppRouter();

beforeEach(() => {
  factory = createAppRouter();
});

afterEach(() => {
  factory.close();
});

test('mutation on mount + subscribe for it', async () => {
  const { trpc, client } = factory;
  function MyComponent() {
    const [posts, setPosts] = useState<Post[]>([]);

    const addPosts = (newPosts?: Post[]) => {
      setPosts((nowPosts) => {
        const map: Record<Post['id'], Post> = {};
        for (const msg of nowPosts ?? []) {
          map[msg.id] = msg;
        }
        for (const msg of newPosts ?? []) {
          map[msg.id] = msg;
        }
        return Object.values(map);
      });
    };
    const input = posts.reduce(
      (num, post) => Math.max(num, post.createdAt),
      -1,
    );

    trpc.useSubscription(['newPosts', input], {
      onNext(post) {
        addPosts([post]);
      },
    });

    const mutation = trpc.useMutation('addPost');
    const mutate = mutation.mutate;
    useEffect(() => {
      if (posts.length === 2) {
        mutate({ title: 'third post' });
      }
    }, [posts.length, mutate]);

    return <pre>{JSON.stringify(posts, null, 4)}</pre>;
  }
  function App() {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <trpc.Provider {...{ queryClient, client }}>
        <QueryClientProvider client={queryClient}>
          <MyComponent />
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  const utils = render(<App />);
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('third post');
  });
});

test('dehydrate', async () => {
  const { db, appRouter } = factory;
  const ssg = createSSGHelpers({ router: appRouter, ctx: {} });

  await ssg.prefetchQuery('allPosts');
  await ssg.fetchQuery('postById', '1');

  const dehydrated = ssg.dehydrate().queries;
  expect(dehydrated).toHaveLength(2);

  const [cache, cache2] = dehydrated;
  expect(cache.queryHash).toMatchInlineSnapshot(`"[\\"allPosts\\"]"`);
  expect(cache.queryKey).toMatchInlineSnapshot(`
    Array [
      "allPosts",
    ]
  `);
  expect(cache.state.data).toEqual(db.posts);
  expect(cache2.state.data).toMatchInlineSnapshot(`
    Object {
      "createdAt": 0,
      "id": "1",
      "title": "first post",
    }
  `);
});

test('prefetchQuery', async () => {
  const { trpc, client } = factory;
  function MyComponent() {
    const [state, setState] = useState<string>('nope');
    const utils = trpc.useContext();
    const queryClient = useQueryClient();

    useEffect(() => {
      async function prefetch() {
        await utils.prefetchQuery(['postById', '1']);
        setState(JSON.stringify(dehydrate(queryClient)));
      }
      prefetch();
    }, [queryClient, utils]);

    return <>{JSON.stringify(state)}</>;
  }
  function App() {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <trpc.Provider {...{ queryClient, client }}>
        <QueryClientProvider client={queryClient}>
          <MyComponent />
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  const utils = render(<App />);
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
  });
});

test('useInfiniteQuery()', async () => {
  const { trpc, client } = factory;

  function MyComponent() {
    const q = trpc.useInfiniteQuery(
      [
        'paginatedPosts',
        {
          limit: 1,
        },
      ],
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );
    expectTypeOf(q.data?.pages[0].items).toMatchTypeOf<undefined | Post[]>();

    return q.status === 'loading' ? (
      <p>Loading...</p>
    ) : q.status === 'error' ? (
      <p>Error: {q.error.message}</p>
    ) : (
      <>
        {q.data?.pages.map((group, i) => (
          <Fragment key={i}>
            {group.items.map((msg) => (
              <Fragment key={msg.id}>
                <div>{msg.title}</div>
              </Fragment>
            ))}
          </Fragment>
        ))}
        <div>
          <button
            onClick={() => q.fetchNextPage()}
            disabled={!q.hasNextPage || q.isFetchingNextPage}
            data-testid="loadMore"
          >
            {q.isFetchingNextPage
              ? 'Loading more...'
              : q.hasNextPage
              ? 'Load More'
              : 'Nothing more to load'}
          </button>
        </div>
        <div>
          {q.isFetching && !q.isFetchingNextPage ? 'Fetching...' : null}
        </div>
      </>
    );
  }
  function App() {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <trpc.Provider {...{ queryClient, client }}>
        <QueryClientProvider client={queryClient}>
          <MyComponent />
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  const utils = render(<App />);
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
    expect(utils.container).not.toHaveTextContent('second post');
    expect(utils.container).toHaveTextContent('Load More');
  });
  userEvent.click(utils.getByTestId('loadMore'));
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('Loading more...');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
    expect(utils.container).toHaveTextContent('second post');
    expect(utils.container).toHaveTextContent('Nothing more to load');
  });

  expect(utils.container).toMatchInlineSnapshot(`
    <div>
      <div>
        first post
      </div>
      <div>
        second post
      </div>
      <div>
        <button
          data-testid="loadMore"
          disabled=""
        >
          Nothing more to load
        </button>
      </div>
      <div />
    </div>
  `);
});

test('useInfiniteQuery and prefetchInfiniteQuery', async () => {
  const { trpc, client } = factory;

  function MyComponent() {
    const trpcContext = trpc.useContext();
    const q = trpc.useInfiniteQuery(
      [
        'paginatedPosts',
        {
          limit: 1,
        },
      ],
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );
    expectTypeOf(q.data?.pages[0].items).toMatchTypeOf<undefined | Post[]>();

    return q.status === 'loading' ? (
      <p>Loading...</p>
    ) : q.status === 'error' ? (
      <p>Error: {q.error.message}</p>
    ) : (
      <>
        {q.data?.pages.map((group, i) => (
          <Fragment key={i}>
            {group.items.map((msg) => (
              <Fragment key={msg.id}>
                <div>{msg.title}</div>
              </Fragment>
            ))}
          </Fragment>
        ))}
        <div>
          <button
            onClick={() => q.fetchNextPage()}
            disabled={!q.hasNextPage || q.isFetchingNextPage}
            data-testid="loadMore"
          >
            {q.isFetchingNextPage
              ? 'Loading more...'
              : q.hasNextPage
              ? 'Load More'
              : 'Nothing more to load'}
          </button>
        </div>
        <div>
          <button
            data-testid="prefetch"
            onClick={() =>
              trpcContext.prefetchInfiniteQuery([
                'paginatedPosts',
                { limit: 1 },
              ])
            }
          >
            Prefetch
          </button>
        </div>
        <div>
          {q.isFetching && !q.isFetchingNextPage ? 'Fetching...' : null}
        </div>
      </>
    );
  }
  function App() {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <trpc.Provider {...{ queryClient, client }}>
        <QueryClientProvider client={queryClient}>
          <MyComponent />
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  const utils = render(<App />);
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
    expect(utils.container).not.toHaveTextContent('second post');
    expect(utils.container).toHaveTextContent('Load More');
  });
  userEvent.click(utils.getByTestId('loadMore'));
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('Loading more...');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
    expect(utils.container).toHaveTextContent('second post');
    expect(utils.container).toHaveTextContent('Nothing more to load');
  });

  expect(utils.container).toMatchInlineSnapshot(`
    <div>
      <div>
        first post
      </div>
      <div>
        second post
      </div>
      <div>
        <button
          data-testid="loadMore"
          disabled=""
        >
          Nothing more to load
        </button>
      </div>
      <div>
        <button
          data-testid="prefetch"
        >
          Prefetch
        </button>
      </div>
      <div />
    </div>
  `);

  userEvent.click(utils.getByTestId('prefetch'));
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('Fetching...');
  });
  await waitFor(() => {
    expect(utils.container).not.toHaveTextContent('Fetching...');
  });

  // It should correctly fetch both pages
  expect(utils.container).toHaveTextContent('first post');
  expect(utils.container).toHaveTextContent('second post');
});

test('useInfiniteQuery and fetchInfiniteQuery', async () => {
  const { trpc, client } = factory;

  function MyComponent() {
    const trpcContext = trpc.useContext();
    const q = trpc.useInfiniteQuery(
      [
        'paginatedPosts',
        {
          limit: 1,
        },
      ],
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );
    expectTypeOf(q.data?.pages[0].items).toMatchTypeOf<undefined | Post[]>();

    return q.status === 'loading' ? (
      <p>Loading...</p>
    ) : q.status === 'error' ? (
      <p>Error: {q.error.message}</p>
    ) : (
      <>
        {q.data?.pages.map((group, i) => (
          <Fragment key={i}>
            {group.items.map((msg) => (
              <Fragment key={msg.id}>
                <div>{msg.title}</div>
              </Fragment>
            ))}
          </Fragment>
        ))}
        <div>
          <button
            onClick={() => q.fetchNextPage()}
            disabled={!q.hasNextPage || q.isFetchingNextPage}
            data-testid="loadMore"
          >
            {q.isFetchingNextPage
              ? 'Loading more...'
              : q.hasNextPage
              ? 'Load More'
              : 'Nothing more to load'}
          </button>
        </div>
        <div>
          <button
            data-testid="fetch"
            onClick={() =>
              trpcContext.fetchInfiniteQuery(['paginatedPosts', { limit: 1 }])
            }
          >
            Fetch
          </button>
        </div>
        <div>
          {q.isFetching && !q.isFetchingNextPage ? 'Fetching...' : null}
        </div>
      </>
    );
  }
  function App() {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <trpc.Provider {...{ queryClient, client }}>
        <QueryClientProvider client={queryClient}>
          <MyComponent />
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  const utils = render(<App />);
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
    expect(utils.container).not.toHaveTextContent('second post');
    expect(utils.container).toHaveTextContent('Load More');
  });
  userEvent.click(utils.getByTestId('loadMore'));
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('Loading more...');
  });
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('first post');
    expect(utils.container).toHaveTextContent('second post');
    expect(utils.container).toHaveTextContent('Nothing more to load');
  });

  expect(utils.container).toMatchInlineSnapshot(`
    <div>
      <div>
        first post
      </div>
      <div>
        second post
      </div>
      <div>
        <button
          data-testid="loadMore"
          disabled=""
        >
          Nothing more to load
        </button>
      </div>
      <div>
        <button
          data-testid="fetch"
        >
          Fetch
        </button>
      </div>
      <div />
    </div>
  `);

  userEvent.click(utils.getByTestId('fetch'));
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('Fetching...');
  });
  await waitFor(() => {
    expect(utils.container).not.toHaveTextContent('Fetching...');
  });

  // It should correctly fetch both pages
  expect(utils.container).toHaveTextContent('first post');
  expect(utils.container).toHaveTextContent('second post');
});

test('prefetchInfiniteQuery()', async () => {
  const { appRouter } = factory;
  const ssg = createSSGHelpers({ router: appRouter, ctx: {} });

  {
    await ssg.prefetchInfiniteQuery('paginatedPosts', { limit: 1 });
    const data = JSON.stringify(ssg.dehydrate());
    expect(data).toContain('first post');
    expect(data).not.toContain('second post');
  }
  {
    await ssg.fetchInfiniteQuery('paginatedPosts', { limit: 2 });
    const data = JSON.stringify(ssg.dehydrate());
    expect(data).toContain('first post');
    expect(data).toContain('second post');
  }
});

test('formatError() react types test', async () => {
  const { trpc, client } = factory;
  function MyComponent() {
    const mutation = trpc.useMutation('addPost');

    useEffect(() => {
      mutation.mutate({ title: 123 as any });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (mutation.error && mutation.error && mutation.error.shape) {
      expectTypeOf(mutation.error.shape).toMatchTypeOf<
        DefaultErrorShape & {
          $test: string;
        }
      >();
      expectTypeOf(mutation.error.shape).toMatchTypeOf<
        DefaultErrorShape & {
          $test: string;
        }
      >();
      return (
        <pre data-testid="err">
          {JSON.stringify(mutation.error.shape.zodError, null, 2)}
        </pre>
      );
    }
    return <></>;
  }
  function App() {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <trpc.Provider {...{ queryClient, client }}>
        <QueryClientProvider client={queryClient}>
          <MyComponent />
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  const utils = render(<App />);
  await waitFor(() => {
    expect(utils.container).toHaveTextContent('fieldErrors');
    expect(utils.getByTestId('err').innerText).toMatchInlineSnapshot(
      `undefined`,
    );
  });
});

/**
 * @link https://github.com/trpc/trpc/pull/1645
 */
xtest('regression: SSR with error sets `status`=`error`', async () => {
  // @ts-ignore
  const { window } = global;

  let queryState: any;
  // @ts-ignore
  delete global.window;
  const { trpc, trpcClientOptions } = factory;
  const App: AppType = () => {
    const query1 = trpc.useQuery(['bad-useQuery'] as any);
    const query2 = trpc.useInfiniteQuery(['bad-useInfiniteQuery'] as any);
    queryState = {
      query1: {
        status: query1.status,
        error: query1.error,
      },
      query2: {
        status: query2.status,
        error: query2.error,
      },
    };
    return <>{JSON.stringify(query1.data || null)}</>;
  };

  const Wrapped = withTRPC({
    config: () => trpcClientOptions,
    ssr: true,
  })(App);

  await Wrapped.getInitialProps!({
    AppTree: Wrapped,
    Component: <div />,
  } as any);

  // @ts-ignore
  global.window = window;
  expect(queryState.query1.error).toMatchInlineSnapshot(
    `[TRPCClientError: No "query"-procedure on path "bad-useQuery"]`,
  );
  expect(queryState.query2.error).toMatchInlineSnapshot(
    `[TRPCClientError: No "query"-procedure on path "bad-useInfiniteQuery"]`,
  );
  expect(queryState.query1.status).toBe('error');
  expect(queryState.query2.status).toBe('error');
});
