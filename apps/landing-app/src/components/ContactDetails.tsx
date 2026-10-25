import Icon from "@/components/Icon";

export const contactPhone = "+94 70 232 9577";
export const contactPhoneHref = "tel:+94702329577";
export const contactAddress = "Rajagiriya";

export default function ContactDetails({ className }: { className?: string }) {
  return (
    <address className={className}>
      <p className="contact-title">Contact</p>
      <a href={contactPhoneHref}>
        <Icon name="phone" />
        <span>{contactPhone}</span>
      </a>
      <span className="contact-address">
        <Icon name="pin" />
        <span>{contactAddress}</span>
      </span>
    </address>
  );
}
