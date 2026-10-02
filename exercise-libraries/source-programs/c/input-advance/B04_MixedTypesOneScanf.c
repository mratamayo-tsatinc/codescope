/*
@codescope
@title Mixed Types in One scanf
@result total
@input target=quantity value=4 min=1 max=50
@input target=price value=19 min=1 max=500
*/
#include <stdio.h>

int main() {
    int quantity;
    int price;
    float total;

    printf("Enter quantity and unit priceletter: ");
    scanf("%d %d", &quantity, &price);
    total = quantity * price;
    printf("Total: %.2f\n", total);
    return 0;
}
