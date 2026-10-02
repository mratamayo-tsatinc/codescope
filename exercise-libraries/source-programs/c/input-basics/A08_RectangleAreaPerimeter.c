/*
@codescope
@title Rectangle Area and Perimeter
@result area
@input target=length value=6 min=1 max=50
@input target=width value=4 min=1 max=50
*/
#include <stdio.h>

int main() {
    int length;
    int width;
    int area;
    int perimeter;

    printf("Enter the length: ");
    scanf("%d", &length);
    printf("Enter the width: ");
    scanf("%d", &width);
    area = length * width;
    perimeter = 2 * (length + width);
    printf("Area: %d\n", area);
    printf("Perimeter: %d\n", perimeter);
    return 0;
}
