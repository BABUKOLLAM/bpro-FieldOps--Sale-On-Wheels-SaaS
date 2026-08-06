from decimal import Decimal

from django.db import transaction

from .models import Godown, StockLedgerEntry, VanStock


@transaction.atomic
def post_stock_movement(
    *, godown: Godown, item, qty: Decimal, txn_type: str, reference_type: str = "", reference_id=None,
) -> StockLedgerEntry:
    """
    The single write path for stock movement. Locks the VanStock row for
    (godown, item), applies the signed qty delta, and writes the
    corresponding ledger entry with the resulting balance — keeping the
    fast-read VanStock summary and the StockLedgerEntry audit trail
    consistent within one transaction.
    """
    van_stock, _ = VanStock.objects.select_for_update().get_or_create(
        godown=godown, item=item, defaults={"qty_on_hand": Decimal("0")}
    )
    van_stock.qty_on_hand = van_stock.qty_on_hand + qty
    van_stock.save(update_fields=["qty_on_hand", "updated_at"])

    return StockLedgerEntry.objects.create(
        godown=godown,
        item=item,
        txn_type=txn_type,
        qty=qty,
        balance_after=van_stock.qty_on_hand,
        reference_type=reference_type,
        reference_id=reference_id,
    )


_OUT_TXN_TYPE = {
    "van_load": StockLedgerEntry.TXN_TRANSFER_OUT,  # leaving the warehouse
    "van_unload": StockLedgerEntry.TXN_VAN_UNLOAD,  # leaving the van
    "warehouse_transfer": StockLedgerEntry.TXN_TRANSFER_OUT,
}
_IN_TXN_TYPE = {
    "van_load": StockLedgerEntry.TXN_VAN_LOAD,  # arriving at the van
    "van_unload": StockLedgerEntry.TXN_TRANSFER_IN,  # arriving at the warehouse
    "warehouse_transfer": StockLedgerEntry.TXN_TRANSFER_IN,
}


@transaction.atomic
def complete_stock_transfer(transfer):
    """Posts a StockTransfer's lines to the ledger: stock out of
    from_godown, stock in to to_godown, using actual_qty where captured
    (variance is expected/actual on the line — see StockTransferLine)."""
    out_txn_type = _OUT_TXN_TYPE[transfer.transfer_type]
    in_txn_type = _IN_TXN_TYPE[transfer.transfer_type]

    for line in transfer.lines.select_related("item").all():
        qty = line.actual_qty if line.actual_qty is not None else line.expected_qty
        post_stock_movement(
            godown=transfer.from_godown, item=line.item, qty=-qty, txn_type=out_txn_type,
            reference_type="stock_transfer", reference_id=transfer.id,
        )
        post_stock_movement(
            godown=transfer.to_godown, item=line.item, qty=qty, txn_type=in_txn_type,
            reference_type="stock_transfer", reference_id=transfer.id,
        )

    from django.utils import timezone

    transfer.status = transfer.STATUS_COMPLETED
    transfer.completed_at = timezone.now()
    transfer.save(update_fields=["status", "completed_at"])
    return transfer
