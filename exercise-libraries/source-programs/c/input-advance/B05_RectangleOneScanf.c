/*
@codescope
@title Rectangle Area and Perimeter in One scanf
@result area
@input target=length value=12 min=1 max=50
@input target=width value=5 min=1 max=50
*/
#include <stdio.h>

int main() {
    int length;
    int width;
    int area;
    int perimeter;

    printf("Enter length and width: ");
    scanf("%d %d", &length, &width);
    area = length * width;
    perimeter = 2 * (length + width);
    printf("Area: %d\n", area);
    printf("Perimeter: %d\n", perimeter);
    return 0;
}
