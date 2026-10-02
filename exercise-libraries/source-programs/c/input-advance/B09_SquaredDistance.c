/*
@codescope
@title Squared Distance Between Two Points
@result distSquared
@input target=x1 value=1 min=-20 max=20
@input target=y1 value=2 min=-20 max=20
@input target=x2 value=4 min=-20 max=20
@input target=y2 value=6 min=-20 max=20
*/
#include <stdio.h>

int main() {
    int x1;
    int y1;
    int x2;
    int y2;
    int dx;
    int dy;
    int distSquared;

    printf("Enter x and y of the first point: ");
    scanf("%d %d", &x1, &y1);
    printf("Enter x and y of the second point: ");
    scanf("%d %d", &x2, &y2);
    dx = x2 - x1;
    dy = y2 - y1;
    distSquared = dx * dx + dy * dy;
    printf("Squared distance: %d\n", distSquared);
    return 0;
}
