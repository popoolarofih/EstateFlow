/**
 * EstateFlow icon set: Solar icons (https://github.com/saoudi-h/solar-icons, MIT).
 *
 * Names are kept stable and semantic for the app; each maps to a Solar glyph. Styles:
 * - weight="regular" (default): Solar Linear, for interface icons
 * - weight="fill": Solar Bold, for selected navigation items and decisive states
 * - weight="duotone": Solar Bold Duotone, for feature and illustration icons
 * Only the styles an icon actually needs are imported, and every icon is a separate tree
 * shakeable export, so pages only ship what they use. Works in Server and Client Components.
 * Generated from a mapping; regenerate rather than hand editing the imports.
 */
import type { ComponentProps, ComponentType } from "react";
import { ArrowDownIcon as ArrowDownLine } from "@solar-icons/react/linear/arrow-down";
import { ArrowLeftIcon as ArrowLeftLine } from "@solar-icons/react/linear/arrow-left";
import { ArrowRightIcon as ArrowRightLine } from "@solar-icons/react/linear/arrow-right";
import { ArrowUpIcon as ArrowUpLine } from "@solar-icons/react/linear/arrow-up";
import { BackspaceIcon as BackspaceLine } from "@solar-icons/react/linear/backspace";
import { BellIcon as BellLine } from "@solar-icons/react/linear/bell";
import { BellIcon as BellDuotone } from "@solar-icons/react/bold-duotone/bell";
import { BellRingIcon as BellRingingLine } from "@solar-icons/react/linear/bell-ring";
import { Buildings2Icon as BuildingsLine } from "@solar-icons/react/linear/buildings-2";
import { Buildings2Icon as BuildingsBold } from "@solar-icons/react/bold/buildings-2";
import { Buildings2Icon as BuildingsDuotone } from "@solar-icons/react/bold-duotone/buildings-2";
import { CameraIcon as CameraLine } from "@solar-icons/react/linear/camera";
import { ChartSquareIcon as ChartBarLine } from "@solar-icons/react/linear/chart-square";
import { ChartSquareIcon as ChartBarBold } from "@solar-icons/react/bold/chart-square";
import { CheckCircleIcon as CheckCircleLine } from "@solar-icons/react/linear/check-circle";
import { CheckCircleIcon as CheckCircleBold } from "@solar-icons/react/bold/check-circle";
import { CheckReadIcon as ChecksLine } from "@solar-icons/react/linear/check-read";
import { ClipboardTextIcon as ClipboardTextLine } from "@solar-icons/react/linear/clipboard-text";
import { ClipboardTextIcon as ClipboardTextDuotone } from "@solar-icons/react/bold-duotone/clipboard-text";
import { ClockCircleIcon as ClockLine } from "@solar-icons/react/linear/clock-circle";
import { HistoryIcon as ClockCounterClockwiseLine } from "@solar-icons/react/linear/history";
import { HistoryIcon as ClockCounterClockwiseBold } from "@solar-icons/react/bold/history";
import { CopyIcon as CopyLine } from "@solar-icons/react/linear/copy";
import { CardIcon as CreditCardLine } from "@solar-icons/react/linear/card";
import { WalletMoneyIcon as CurrencyNgnLine } from "@solar-icons/react/linear/wallet-money";
import { WalletMoneyIcon as CurrencyNgnBold } from "@solar-icons/react/bold/wallet-money";
import { WalletMoneyIcon as CurrencyNgnDuotone } from "@solar-icons/react/bold-duotone/wallet-money";
import { SmartphoneIcon as DeviceMobileLine } from "@solar-icons/react/linear/smartphone";
import { SmartphoneIcon as DeviceMobileDuotone } from "@solar-icons/react/bold-duotone/smartphone";
import { DoorClosedIcon as DoorOpenLine } from "@solar-icons/react/linear/door-closed";
import { DownloadMinimalisticIcon as DownloadSimpleLine } from "@solar-icons/react/linear/download-minimalistic";
import { LetterIcon as EnvelopeSimpleLine } from "@solar-icons/react/linear/letter";
import { DocumentTextIcon as FileTextLine } from "@solar-icons/react/linear/document-text";
import { FingerprintIcon as FingerprintLine } from "@solar-icons/react/linear/fingerprint";
import { FingerprintIcon as FingerprintDuotone } from "@solar-icons/react/bold-duotone/fingerprint";
import { GavelIcon as GavelLine } from "@solar-icons/react/linear/gavel";
import { GavelIcon as GavelDuotone } from "@solar-icons/react/bold-duotone/gavel";
import { SettingsIcon as GearLine } from "@solar-icons/react/linear/settings";
import { SettingsIcon as GearBold } from "@solar-icons/react/bold/settings";
import { SledgehammerIcon as HardHatLine } from "@solar-icons/react/linear/sledgehammer";
import { HomeIcon as HouseLine } from "@solar-icons/react/linear/home";
import { HomeIcon as HouseBold } from "@solar-icons/react/bold/home";
import { BoltIcon as LightningLine } from "@solar-icons/react/linear/bolt";
import { HamburgerMenuIcon as ListLine } from "@solar-icons/react/linear/hamburger-menu";
import { LockKeyholeMinimalisticIcon as LockKeyLine } from "@solar-icons/react/linear/lock-keyhole-minimalistic";
import { LockKeyholeMinimalisticIcon as LockKeyDuotone } from "@solar-icons/react/bold-duotone/lock-keyhole-minimalistic";
import { NotebookIcon as NotebookLine } from "@solar-icons/react/linear/notebook";
import { NotebookIcon as NotebookBold } from "@solar-icons/react/bold/notebook";
import { NotebookIcon as NotebookDuotone } from "@solar-icons/react/bold-duotone/notebook";
import { KeyboardIcon as NumpadLine } from "@solar-icons/react/linear/keyboard";
import { KeyboardIcon as NumpadBold } from "@solar-icons/react/bold/keyboard";
import { PenIcon as PencilSimpleLine } from "@solar-icons/react/linear/pen";
import { PhoneIcon as PhoneLine } from "@solar-icons/react/linear/phone";
import { AddCircleIcon as PlusLine } from "@solar-icons/react/linear/add-circle";
import { PrinterIcon as PrinterLine } from "@solar-icons/react/linear/printer";
import { ForbiddenCircleIcon as ProhibitLine } from "@solar-icons/react/linear/forbidden-circle";
import { ForbiddenCircleIcon as ProhibitBold } from "@solar-icons/react/bold/forbidden-circle";
import { QrCodeIcon as QrCodeLine } from "@solar-icons/react/linear/qr-code";
import { BillListIcon as ReceiptLine } from "@solar-icons/react/linear/bill-list";
import { ClipboardListIcon as ScrollLine } from "@solar-icons/react/linear/clipboard-list";
import { ClipboardListIcon as ScrollBold } from "@solar-icons/react/bold/clipboard-list";
import { ClipboardListIcon as ScrollDuotone } from "@solar-icons/react/bold-duotone/clipboard-list";
import { ShareIcon as ShareNetworkLine } from "@solar-icons/react/linear/share";
import { ShieldCheckIcon as ShieldCheckLine } from "@solar-icons/react/linear/shield-check";
import { ShieldCheckIcon as ShieldCheckDuotone } from "@solar-icons/react/bold-duotone/shield-check";
import { Logout2Icon as SignOutLine } from "@solar-icons/react/linear/logout-2";
import { SirenRoundedIcon as SirenLine } from "@solar-icons/react/linear/siren-rounded";
import { SirenRoundedIcon as SirenBold } from "@solar-icons/react/bold/siren-rounded";
import { SirenRoundedIcon as SirenDuotone } from "@solar-icons/react/bold-duotone/siren-rounded";
import { TrashBinTrashIcon as TrashLine } from "@solar-icons/react/linear/trash-bin-trash";
import { DeliveryIcon as TruckLine } from "@solar-icons/react/linear/delivery";
import { UploadMinimalisticIcon as UploadSimpleLine } from "@solar-icons/react/linear/upload-minimalistic";
import { UserIcon as UserLine } from "@solar-icons/react/linear/user";
import { UserCircleIcon as UserCircleLine } from "@solar-icons/react/linear/user-circle";
import { UserCircleIcon as UserCircleBold } from "@solar-icons/react/bold/user-circle";
import { UserPlusIcon as UserPlusLine } from "@solar-icons/react/linear/user-plus";
import { UsersGroupRoundedIcon as UsersLine } from "@solar-icons/react/linear/users-group-rounded";
import { UsersGroupRoundedIcon as UsersBold } from "@solar-icons/react/bold/users-group-rounded";
import { UsersGroupRoundedIcon as UsersDuotone } from "@solar-icons/react/bold-duotone/users-group-rounded";
import { UsersGroupTwoRoundedIcon as UsersThreeLine } from "@solar-icons/react/linear/users-group-two-rounded";
import { UsersGroupTwoRoundedIcon as UsersThreeDuotone } from "@solar-icons/react/bold-duotone/users-group-two-rounded";
import { DangerTriangleIcon as WarningLine } from "@solar-icons/react/linear/danger-triangle";
import { DangerCircleIcon as WarningCircleLine } from "@solar-icons/react/linear/danger-circle";
import { DangerCircleIcon as WarningCircleBold } from "@solar-icons/react/bold/danger-circle";
import { ChatRoundDotsIcon as WhatsappLogoLine } from "@solar-icons/react/linear/chat-round-dots";
import { CloudCrossIcon as WifiSlashLine } from "@solar-icons/react/linear/cloud-cross";
import { CloudCrossIcon as WifiSlashBold } from "@solar-icons/react/bold/cloud-cross";
import { WrenchIcon as WrenchLine } from "@solar-icons/react/linear/wrench";
import { WrenchIcon as WrenchBold } from "@solar-icons/react/bold/wrench";
import { WrenchIcon as WrenchDuotone } from "@solar-icons/react/bold-duotone/wrench";
import { CloseCircleIcon as XLine } from "@solar-icons/react/linear/close-circle";

type SolarComponent = ComponentType<ComponentProps<typeof HouseLine>>;

export type IconWeight = "regular" | "fill" | "duotone";

export interface IconProps extends Omit<ComponentProps<typeof HouseLine>, "ref"> {
  weight?: IconWeight;
}

export type Icon = ComponentType<IconProps>;

function solar(name: string, Line: SolarComponent, Bold?: SolarComponent, Duotone?: SolarComponent): Icon {
  function SolarIcon({ weight = "regular", ...props }: IconProps) {
    const Variant = weight === "fill" ? (Bold ?? Line) : weight === "duotone" ? (Duotone ?? Bold ?? Line) : Line;
    return <Variant {...props} />;
  }
  SolarIcon.displayName = `Icon(${name})`;
  return SolarIcon;
}

export const ArrowDown = /* @__PURE__ */ solar("ArrowDown", ArrowDownLine);
export const ArrowLeft = /* @__PURE__ */ solar("ArrowLeft", ArrowLeftLine);
export const ArrowRight = /* @__PURE__ */ solar("ArrowRight", ArrowRightLine);
export const ArrowUp = /* @__PURE__ */ solar("ArrowUp", ArrowUpLine);
export const Backspace = /* @__PURE__ */ solar("Backspace", BackspaceLine);
export const Bell = /* @__PURE__ */ solar("Bell", BellLine, undefined, BellDuotone);
export const BellRinging = /* @__PURE__ */ solar("BellRinging", BellRingingLine);
export const Buildings = /* @__PURE__ */ solar("Buildings", BuildingsLine, BuildingsBold, BuildingsDuotone);
export const Camera = /* @__PURE__ */ solar("Camera", CameraLine);
export const ChartBar = /* @__PURE__ */ solar("ChartBar", ChartBarLine, ChartBarBold);
export const CheckCircle = /* @__PURE__ */ solar("CheckCircle", CheckCircleLine, CheckCircleBold);
export const Checks = /* @__PURE__ */ solar("Checks", ChecksLine);
export const ClipboardText = /* @__PURE__ */ solar("ClipboardText", ClipboardTextLine, undefined, ClipboardTextDuotone);
export const Clock = /* @__PURE__ */ solar("Clock", ClockLine);
export const ClockCounterClockwise = /* @__PURE__ */ solar("ClockCounterClockwise", ClockCounterClockwiseLine, ClockCounterClockwiseBold);
export const Copy = /* @__PURE__ */ solar("Copy", CopyLine);
export const CreditCard = /* @__PURE__ */ solar("CreditCard", CreditCardLine);
export const CurrencyNgn = /* @__PURE__ */ solar("CurrencyNgn", CurrencyNgnLine, CurrencyNgnBold, CurrencyNgnDuotone);
export const DeviceMobile = /* @__PURE__ */ solar("DeviceMobile", DeviceMobileLine, undefined, DeviceMobileDuotone);
export const DoorOpen = /* @__PURE__ */ solar("DoorOpen", DoorOpenLine);
export const DownloadSimple = /* @__PURE__ */ solar("DownloadSimple", DownloadSimpleLine);
export const EnvelopeSimple = /* @__PURE__ */ solar("EnvelopeSimple", EnvelopeSimpleLine);
export const FileText = /* @__PURE__ */ solar("FileText", FileTextLine);
export const Fingerprint = /* @__PURE__ */ solar("Fingerprint", FingerprintLine, undefined, FingerprintDuotone);
export const Gavel = /* @__PURE__ */ solar("Gavel", GavelLine, undefined, GavelDuotone);
export const Gear = /* @__PURE__ */ solar("Gear", GearLine, GearBold);
export const HardHat = /* @__PURE__ */ solar("HardHat", HardHatLine);
export const House = /* @__PURE__ */ solar("House", HouseLine, HouseBold);
export const Lightning = /* @__PURE__ */ solar("Lightning", LightningLine);
export const List = /* @__PURE__ */ solar("List", ListLine);
export const LockKey = /* @__PURE__ */ solar("LockKey", LockKeyLine, undefined, LockKeyDuotone);
export const Notebook = /* @__PURE__ */ solar("Notebook", NotebookLine, NotebookBold, NotebookDuotone);
export const Numpad = /* @__PURE__ */ solar("Numpad", NumpadLine, NumpadBold);
export const PencilSimple = /* @__PURE__ */ solar("PencilSimple", PencilSimpleLine);
export const Phone = /* @__PURE__ */ solar("Phone", PhoneLine);
export const Plus = /* @__PURE__ */ solar("Plus", PlusLine);
export const Printer = /* @__PURE__ */ solar("Printer", PrinterLine);
export const Prohibit = /* @__PURE__ */ solar("Prohibit", ProhibitLine, ProhibitBold);
export const QrCode = /* @__PURE__ */ solar("QrCode", QrCodeLine);
export const Receipt = /* @__PURE__ */ solar("Receipt", ReceiptLine);
export const Scroll = /* @__PURE__ */ solar("Scroll", ScrollLine, ScrollBold, ScrollDuotone);
export const ShareNetwork = /* @__PURE__ */ solar("ShareNetwork", ShareNetworkLine);
export const ShieldCheck = /* @__PURE__ */ solar("ShieldCheck", ShieldCheckLine, undefined, ShieldCheckDuotone);
export const SignOut = /* @__PURE__ */ solar("SignOut", SignOutLine);
export const Siren = /* @__PURE__ */ solar("Siren", SirenLine, SirenBold, SirenDuotone);
export const Trash = /* @__PURE__ */ solar("Trash", TrashLine);
export const Truck = /* @__PURE__ */ solar("Truck", TruckLine);
export const UploadSimple = /* @__PURE__ */ solar("UploadSimple", UploadSimpleLine);
export const User = /* @__PURE__ */ solar("User", UserLine);
export const UserCircle = /* @__PURE__ */ solar("UserCircle", UserCircleLine, UserCircleBold);
export const UserPlus = /* @__PURE__ */ solar("UserPlus", UserPlusLine);
export const Users = /* @__PURE__ */ solar("Users", UsersLine, UsersBold, UsersDuotone);
export const UsersThree = /* @__PURE__ */ solar("UsersThree", UsersThreeLine, undefined, UsersThreeDuotone);
export const Warning = /* @__PURE__ */ solar("Warning", WarningLine);
export const WarningCircle = /* @__PURE__ */ solar("WarningCircle", WarningCircleLine, WarningCircleBold);
export const WhatsappLogo = /* @__PURE__ */ solar("WhatsappLogo", WhatsappLogoLine);
export const WifiSlash = /* @__PURE__ */ solar("WifiSlash", WifiSlashLine, WifiSlashBold);
export const Wrench = /* @__PURE__ */ solar("Wrench", WrenchLine, WrenchBold, WrenchDuotone);
export const X = /* @__PURE__ */ solar("X", XLine);
