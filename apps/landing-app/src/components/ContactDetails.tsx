import Icon from "@/components/Icon";

export const contactPhone = "+94 74 188 0065";
export const contactPhoneHref = "tel:+94741880065";
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
