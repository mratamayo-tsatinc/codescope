/*
@codescope
@title Output without a trailing newline
@result difference
*/
public class NoTrailingNewline {
    public static void main(String[] args) {
        int high = 18;
        int low = 6;
        int difference = high - low;

        System.out.print(high + " minus " + low + " equals " + difference);
    }
}
