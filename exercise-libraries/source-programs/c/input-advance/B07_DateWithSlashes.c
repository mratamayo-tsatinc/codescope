/*
@codescope
@title Reading a Date with Slashes
@result code
@input target=month value=10 min=1 max=12
@input target=day value=2 min=1 max=31
@input target=year value=2026 min=1900 max=2100
*/
#include <stdio.h>

int main() {
    int month;
    int day;
    int year;
    int code;

    printf("Enter a date as MM DD YYYY: ");
    scanf("%d %d %d", &month, &day, &year);
    code = year * 10000 + month * 100 + day;
    printf("Month: %d\n", month);
    printf("Day: %d\n", day);
    printf("Year: %d\n", year);
    printf("Sortable code: %d\n", code);
    return 0;
}
