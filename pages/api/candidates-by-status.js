import { prisma } from '../../lib/prisma';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { status } = req.query;

  if (!status) {
    return res.status(400).json({ error: 'Status parameter is required' });
  }

  try {
    let candidates;

    if (status === 'ALL') {
      // Get all candidates
      candidates = await prisma.candidate.findMany({
        include: {
          interviews: {
            include: {
              oc1: {
                select: {
                  name: true,
                },
              },
              oc2: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              startTime: 'asc',
            },
            take: 1,
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (status === 'SCHEDULED') {
      // Get candidates with scheduled interviews
      candidates = await prisma.candidate.findMany({
        where: {
          status: 'SCHEDULED',
        },
        include: {
          interviews: {
            where: {
              status: 'SCHEDULED',
            },
            include: {
              oc1: {
                select: {
                  name: true,
                },
              },
              oc2: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              startTime: 'asc',
            },
            take: 1,
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (status === 'COMPLETED') {
      // Get candidates with completed interviews
      candidates = await prisma.candidate.findMany({
        where: {
          status: 'COMPLETED',
        },
        include: {
          interviews: {
            where: {
              status: 'COMPLETED',
            },
            include: {
              oc1: {
                select: {
                  name: true,
                },
              },
              oc2: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              startTime: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else {
      return res.status(400).json({ error: 'Invalid status' });
    }

    return res.status(200).json({ candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return res.status(500).json({ error: error.message });
  }
}
