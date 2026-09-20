-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('TO_CONTACT', 'AWAITING_REPLY', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "venue" TEXT;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "lastContactedAt" TIMESTAMP(3),
ADD COLUMN     "status" "VendorStatus" NOT NULL DEFAULT 'TO_CONTACT';

