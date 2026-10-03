"""Vietnamese number to words converter for currency receipts."""

from decimal import Decimal

UNITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
SCALES = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"]


def _read_three_digits(n: int, show_zero_hundred: bool = True) -> str:
    hundred = n // 100
    remainder = n % 100
    ten = remainder // 10
    unit = remainder % 10

    parts: list[str] = []

    if hundred > 0 or show_zero_hundred:
        parts.append(f"{UNITS[hundred]} trăm")

    if ten > 1:
        parts.append(f"{UNITS[ten]} mươi")
        if unit == 1:
            parts.append("mốt")
        elif unit == 5:
            parts.append("lăm")
        elif unit > 0:
            parts.append(UNITS[unit])
    elif ten == 1:
        parts.append("mười")
        if unit == 5:
            parts.append("lăm")
        elif unit > 0:
            parts.append(UNITS[unit])
    elif ten == 0:
        if unit > 0:
            if hundred > 0 or show_zero_hundred:
                parts.append(f"linh {UNITS[unit]}")
            else:
                parts.append(UNITS[unit])

    return " ".join(parts)


def number_to_vietnamese_words(amount: Decimal | int | float) -> str:
    """Convert a non-negative currency amount to Vietnamese words, e.g., 'Mười lăm triệu đồng chẵn'."""
    val = int(amount)
    if val == 0:
        return "Không đồng chẵn"

    groups: list[int] = []
    temp = val
    while temp > 0:
        groups.append(temp % 1000)
        temp //= 1000

    words: list[str] = []
    total_groups = len(groups)

    for i in reversed(range(total_groups)):
        grp = groups[i]
        if grp == 0:
            continue

        # For the highest group, don't say "không trăm" if hundred is 0
        show_zero = i < total_groups - 1
        read_grp = _read_three_digits(grp, show_zero_hundred=show_zero)
        scale = SCALES[i]

        if scale:
            words.append(f"{read_grp} {scale}")
        else:
            words.append(read_grp)

    result = " ".join(words).strip()
    # Capitalize the first letter and append "đồng chẵn"
    result = result[0].upper() + result[1:] + " đồng chẵn"
    return result
