import { useState } from "react";
import { useNavigate } from "react-router";

import { errorMessage } from "@/api/errors";
import { useListingAction, usePlaceOrder } from "@/api/queries/marketplace";
import { startCheckout } from "@/api/queries/payments";
import type { Listing } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/format";

import styles from "./Sell.module.css";

/** Order form on a listing: quantity, pickup or delivery, then Paystack (or cash on pickup). */
export function BuyPanel({ listing: l }: { listing: Listing }) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const place = usePlaceOrder();
  const [quantity, setQuantity] = useState(1);
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">(l.allows_pickup ? "pickup" : "delivery");
  const [cash, setCash] = useState(false);
  const [address, setAddress] = useState("");
  const [paying, setPaying] = useState(false);

  if (me && l.seller?.id === me.id) return <OwnerActions listing={l} />;
  if (l.status !== "active" || l.quantity < 1) {
    return <Alert tone="info">This item isn't available right now.</Alert>;
  }

  const delivery = fulfilment === "delivery" ? (l.delivery_fee_minor ?? 0) : 0;
  const total = l.price_minor * quantity + delivery;
  const cashAllowed = fulfilment === "pickup" && l.allows_cash_on_pickup;

  const onBuy = async () => {
    try {
      const order = await place.mutateAsync({
        listing: l.id,
        quantity,
        fulfilment,
        payment_method: cash && cashAllowed ? "cash_on_pickup" : "online",
        delivery_details: fulfilment === "delivery" ? address : "",
      });
      if (order.status === "pending_payment") {
        setPaying(true);
        await startCheckout("marketplace.order", order.id);
      } else {
        toast.success("Order placed. Arrange the pickup with the seller.");
        navigate("/marketplace/orders");
      }
    } catch (error) {
      setPaying(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        {l.quantity > 1 && (
          <Field label="Quantity">
            <Input
              type="number"
              min={1}
              max={l.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(l.quantity, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
        )}
        {l.allows_pickup && l.allows_delivery && (
          <Field label="How you'll get it">
            <Select value={fulfilment} onChange={(e) => setFulfilment(e.target.value as "pickup" | "delivery")}>
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </Select>
          </Field>
        )}
      </div>
      {fulfilment === "delivery" && (
        <Field label="Delivery address" hint="Only the seller sees this.">
          <Textarea rows={2} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      )}
      {cashAllowed && (
        <Field label="Payment">
          <Select value={cash ? "cash" : "online"} onChange={(e) => setCash(e.target.value === "cash")}>
            <option value="online">Pay online (protected by escrow)</option>
            <option value="cash">Cash on pickup</option>
          </Select>
        </Field>
      )}
      <div className={styles.summary}>
        <span>Total</span>
        <span>{formatMoney(total, l.currency)}</span>
      </div>
      <Button
        size="lg"
        block
        loading={place.isPending || paying}
        disabled={fulfilment === "delivery" && !address.trim()}
        onClick={() => void onBuy()}
      >
        {cash && cashAllowed ? "Place order" : `Pay ${formatMoney(total, l.currency)}`}
      </Button>
    </div>
  );
}

function OwnerActions({ listing: l }: { listing: Listing }) {
  const action = useListingAction();
  const toast = useToast();
  const run = (next: "publish" | "pause") =>
    action.mutate(
      { listingId: l.id, action: next },
      {
        onSuccess: () => toast.success(next === "publish" ? "Your listing is live" : "Listing paused"),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  return (
    <div className="stack">
      <Alert tone="info">This is your listing ({l.status.replace("_", " ")}).</Alert>
      <div className="cluster">
        {l.status === "active" ? (
          <Button variant="secondary" loading={action.isPending} onClick={() => run("pause")}>
            Pause listing
          </Button>
        ) : (
          l.status !== "removed" && (
            <Button loading={action.isPending} onClick={() => run("publish")}>
              Publish
            </Button>
          )
        )}
        {l.status === "active" && l.visibility === "public" && (
          <ButtonLink variant="secondary" to={`/promote/new?type=marketplace.listing&id=${l.id}`}>
            Boost
          </ButtonLink>
        )}
        <ButtonLink variant="ghost" to="/marketplace/orders?role=seller">
          Orders
        </ButtonLink>
      </div>
    </div>
  );
}
