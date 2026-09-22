/*
@output
initial total: 20
35->27->81->20->0

initial balance: 100.00
final balance: 65.12

@variables
total = 0
balance = 65.12
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

    float balance = 100.0;
    printf("initial balance: %.2f\n", balance);

    balance += 50.5;
    balance -= 20.25;
    balance *= 2;
    balance /= 4;

    printf("final balance: %.2f\n", balance);

    return 0;
}