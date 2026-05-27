import { prisma } from '@/lib/prisma';

export class AddressError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AddressError';
  }
}

export async function getUserAddresses(userId: number) {
  return prisma.userAddress.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createAddress(
  userId: number,
  data: {
    label?: string;
    city: string;
    street?: string;
    building?: string;
    apartment?: string;
    postalCode?: string;
    isDefault?: boolean;
  },
) {
  // Wrap in a transaction so two concurrent POSTs marking isDefault=true
  // can't both win the race and leave the user with two default addresses.
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.userAddress.create({
      data: { userId, ...data },
    });
  });
}

export async function updateAddress(
  userId: number,
  addressId: number,
  data: {
    label?: string;
    city?: string;
    street?: string;
    building?: string;
    apartment?: string;
    postalCode?: string;
    isDefault?: boolean;
  },
) {
  // Atomic: ownership check, unset-old-default and update all in one tx.
  // Pre-fix flow had a window where a parallel update could leave 0 or 2
  // default addresses on the user.
  return prisma.$transaction(async (tx) => {
    const address = await tx.userAddress.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) throw new AddressError('Адресу не знайдено', 404);

    if (data.isDefault) {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return tx.userAddress.update({
      where: { id: addressId },
      data,
    });
  });
}

export async function deleteAddress(userId: number, addressId: number) {
  const address = await prisma.userAddress.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new AddressError('Адресу не знайдено', 404);

  await prisma.userAddress.delete({ where: { id: addressId } });
}
