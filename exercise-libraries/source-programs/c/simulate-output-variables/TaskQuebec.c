/*
@codescope
@title Compound assignments
@seed total min=10 max=30
@seed balance min=80.00 max=150.00 decimals=2
*/
#include <stdio.h>

int main() {
    int total = 20;
    printf("initial total: %d\n", total);

    total += 15;
    printf("%d->", total);

    total -= 8;
    printf("%d->", total);

    total *= 3;
    printf("%d->", total);

    total /= 4;
    printf("%d->", total);

    total %= 5;
    printf("%d\n\n", total);

    float balance = 100.25;
    printf("initial balance: %.2f\n", balance);

    balance += 50.5;
    balance -= 20.25;
    balance *= 2;
    balance /= 4;

    printf("final balance: %.2f\n", balance);

    return 0;
}
