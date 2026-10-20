/*
@codescope
@title Repeat a message with while
@seed limit min=3 max=5
*/
public class RepeatMessage {
    public static void main(String[] args) {
        int count = 0;
        int limit = 4;

        while (count < limit) {
            System.out.println("Hello, loop!");
            System.out.println("Practice makes progress.");
            System.out.println("Repeat once more.");
            count++;
        }

        System.out.println("finished");
    }
}
